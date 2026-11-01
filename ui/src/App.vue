<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useGameStore } from '@/stores/game'
import { useSettingsStore } from '@/stores/settings'
import { useNetStore } from '@/stores/net'
import { useGameFlow } from '@/composables/useGameFlow'
import { useAnimStore } from '@/stores/anim'
import { useFeedback } from '@/composables/useFeedback'
import { useI18n } from '@/i18n'
import { DEBUG } from '@/utils/env'
import LudoBoard from '@/components/board/LudoBoard.vue'
import PlayerCard from '@/components/hud/PlayerCard.vue'
import TopBar from '@/components/hud/TopBar.vue'
import ToastStack from '@/components/hud/ToastStack.vue'
import WinScreen from '@/components/hud/WinScreen.vue'
import DebugToolbar from '@/components/hud/DebugToolbar.vue'
import EventBanner from '@/components/hud/EventBanner.vue'
import LobbyModal from '@/components/hud/LobbyModal.vue'
import SetupScreen from '@/components/screens/SetupScreen.vue'
import LobbyScreen from '@/components/screens/LobbyScreen.vue'
import { COLORS, type NewPlayerSpec, type PlayerColor } from '@/engine'
import type { SeatMap } from '@/net/protocol'

const game = useGameStore()
const settings = useSettingsStore()
const net = useNetStore()
const flow = useGameFlow()
const anim = useAnimStore()
const { t, displayName } = useI18n()
useFeedback()

type Screen = 'setup' | 'lobby' | 'game'
const screen = ref<Screen>('setup')
const lobbyOpen = ref(false)
const lobbyBots = ref(0)
const showDebug = computed(() => DEBUG || settings.debugToolbar)
const prefillRoom = new URLSearchParams(location.search).get('room')?.toUpperCase() ?? ''
const prefillName = new URLSearchParams(location.search).get('name') ?? ''
const rejoinCode = ref(net.savedSeat()?.code ?? '')

/** Seat colours for N players: 2P is the classic diagonal. */
const SEATS: Record<number, PlayerColor[]> = {
  2: ['red', 'yellow'],
  3: ['red', 'green', 'yellow'],
  4: [...COLORS],
}

function beginGame(players: NewPlayerSpec[], seats: SeatMap = {}) {
  anim.trigger('tap')
  flow.cancel()
  net.setSeats(seats)
  game.newGame({
    players,
    settings: { blockingRule: settings.blockingRule, endAtFirstWinner: settings.endAtFirstWinner, autoMoveSingle: settings.autoMoveSingle },
  })
  screen.value = 'game'
  flow.kick()
}

/** Pass & play from the setup screen. */
function start(players: NewPlayerSpec[]) {
  if (net.active) net.leave()
  beginGame(players)
}

/** LAN host: seats = host, joiners in lobby order, then bots. */
function startLan() {
  const humans = net.players
  const n = Math.min(4, humans.length + lobbyBots.value)
  if (n < 2) return
  const colors = SEATS[n]
  const seats: SeatMap = {}
  const players: NewPlayerSpec[] = []
  humans.slice(0, n).forEach((p, i) => {
    seats[p.id] = colors[i]
    players.push({ color: colors[i], name: p.name })
  })
  for (let i = humans.length; i < n; i++) players.push({ color: colors[i], name: `${t('bot')} ${i - humans.length + 1}`, isBot: true })
  beginGame(players, seats)
}

function resume() {
  if (game.resume()) {
    screen.value = 'game'
    flow.kick()
  }
}

function hostRoom(name: string) {
  net.host(name)
  lobbyBots.value = 0
  screen.value = 'lobby'
}

function joinRoom(code: string, name: string) {
  net.join(code, name)
  screen.value = 'lobby'
}

/** Reattach to a saved LAN seat. The host also restores its saved game and re-broadcasts it. */
function rejoin() {
  if (!net.reconnect()) return
  const saved = net.savedSeat()
  if (saved?.isHost && game.resume()) {
    screen.value = 'game'
    flow.kick()
  } else {
    screen.value = 'lobby'
  }
}

/** Rematch with the same seats, names and bots as the game that just ended. */
function again() {
  const players: NewPlayerSpec[] = game.players.map((p) => ({ color: p.color, name: p.name, isBot: p.isBot }))
  if (players.length) beginGame(players, net.seats)
  else toMenu()
}

function restart(count: 2 | 4) {
  const seats = SEATS[count]
  beginGame(seats.map((color) => ({ color, name: game.playerByColor(color)?.name, isBot: game.playerByColor(color)?.isBot ?? false })))
}

function toMenu() {
  flow.cancel()
  game.quit()
  net.leave()
  rejoinCode.value = ''
  lobbyOpen.value = false
  screen.value = 'setup'
}

// A joiner enters the game as soon as the host's state arrives; a host re-broadcasts on reconnect.
watch(
  () => game.state,
  (s) => {
    if (s && net.isJoiner && screen.value !== 'game') screen.value = 'game'
  },
)
watch(
  () => net.connected,
  (ok) => {
    if (ok && net.isHost && game.state) net.broadcastState(game.state, [])
  },
)
// If the server rejects a join (bad code, full room), fall back to the setup screen with the error shown.
watch(
  () => net.error,
  (e) => {
    if (e && screen.value === 'lobby' && !net.playerId) {
      net.leave()
      lanError.value = e
      screen.value = 'setup'
    }
  },
)
const lanError = ref('')

onMounted(() => {
  if (prefillRoom) history.replaceState(null, '', location.pathname + (DEBUG ? '?debug' : ''))
})

const seat = (color: PlayerColor) => computed(() => game.playerByColor(color))
const red = seat('red')
const green = seat('green')
const yellow = seat('yellow')
const blue = seat('blue')
const activeColor = computed(() => game.current?.color ?? null)

const status = computed(() => {
  const me = game.current
  if (!me || game.isOver) return ''
  const name = displayName(me)
  if (me.isBot) return t('botThinking', { name })
  if (!flow.localHumanTurn.value) return t('turnOf', { name })
  if (game.phase === 'move') return t('chooseToken')
  return `${t('turnOf', { name })} · ${t('tapDice')}`
})

const cardProps = (color: PlayerColor) => ({
  active: activeColor.value === color,
  dice: activeColor.value === color ? game.dice : null,
  canRoll: activeColor.value === color && flow.canRoll.value,
  rolling: activeColor.value === color && flow.rolling.value,
})

const topMode = computed(() => (net.isHost ? 'lan-host' : net.isJoiner ? 'lan-join' : 'pass-play'))
const lobbyUrl = computed(() => net.joinUrl || `${location.protocol}//${location.host}/?room=LUDO`)
</script>

<template>
  <SetupScreen
    v-if="screen === 'setup'"
    :can-resume="game.hasSave"
    :rejoin-code="rejoinCode"
    :prefill-room="prefillRoom"
    :prefill-name="prefillName"
    :lan-error="lanError"
    @start="start"
    @resume="resume"
    @host="hostRoom"
    @join="joinRoom"
    @rejoin="rejoin"
  />

  <LobbyScreen
    v-else-if="screen === 'lobby'"
    v-model:bots="lobbyBots"
    @start="startLan"
    @leave="toMenu"
  />

  <div
    v-else
    class="app"
    :data-phase="game.phase"
    :data-turn="activeColor"
    :data-busy="flow.busy.value"
    :data-mode="net.mode"
  >
    <TopBar
      :mode="topMode"
      :room-label="net.code ? `${t('room')} ${net.code}` : undefined"
      :connected="net.connected"
      :sound="settings.sound"
      :haptics="settings.haptics"
      @toggle-sound="settings.sound = !settings.sound"
      @toggle-haptics="settings.haptics = !settings.haptics"
      @open-room="net.active ? (lobbyOpen = true) : toMenu()"
    />

    <div class="table">
      <div class="row">
        <PlayerCard
          v-if="red"
          :player="red"
          v-bind="cardProps('red')"
          dice-left
          @roll="flow.roll"
        />
        <div v-else />
        <PlayerCard
          v-if="green"
          :player="green"
          v-bind="cardProps('green')"
          @roll="flow.roll"
        />
        <div v-else />
      </div>

      <p
        class="status"
        data-status
        :style="activeColor ? { '--c': `var(--color-ludo-${activeColor})` } : undefined"
      >
        {{ status }}
      </p>

      <div
        class="stage"
        :class="{ 'stage--shake': anim.shake }"
      >
        <LudoBoard
          :players="game.players"
          :active-color="activeColor"
          :movable="flow.movable.value"
          @select="flow.move"
        />
        <EventBanner />
      </div>

      <div class="row">
        <PlayerCard
          v-if="blue"
          :player="blue"
          v-bind="cardProps('blue')"
          dice-left
          @roll="flow.roll"
        />
        <div v-else />
        <PlayerCard
          v-if="yellow"
          :player="yellow"
          v-bind="cardProps('yellow')"
          @roll="flow.roll"
        />
        <div v-else />
      </div>
    </div>

    <DebugToolbar
      v-if="showDebug && !net.isJoiner"
      :can-roll="!flow.busy.value && game.phase === 'roll'"
      @force="flow.rollForced"
      @restart="restart"
      @lobby="lobbyOpen = true"
    />

    <LobbyModal
      :open="lobbyOpen"
      :join-url="lobbyUrl"
      :room-code="net.code || 'LUDO'"
      :preview="!net.active"
      :players="net.players"
      @close="lobbyOpen = false"
    />

    <WinScreen
      v-if="game.isOver && game.state"
      :ranking="game.state.ranking"
      :players="game.players"
      :can-restart="!net.isJoiner"
      @again="again"
      @menu="toMenu"
    />
  </div>

  <ToastStack />
</template>

<style scoped>
.app {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: calc(env(safe-area-inset-top) + 0.6rem) 0.75rem calc(env(safe-area-inset-bottom) + 0.6rem);
  max-width: 560px;
  margin: 0 auto;
  background:
    radial-gradient(ellipse at 50% -10%, rgba(245, 184, 0, 0.18), transparent 55%),
    radial-gradient(ellipse at 50% 110%, rgba(43, 111, 230, 0.2), transparent 55%);
}
.table {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.5rem;
}
.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}
.status {
  margin: 0;
  min-height: 1.1rem;
  text-align: center;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: color-mix(in srgb, var(--c, #fff) 55%, #fff);
  opacity: 0.9;
}
.stage {
  position: relative;
  min-height: 0;
  display: grid;
  place-items: center;
}
.stage--shake {
  animation: shake 180ms ease-in-out;
}
@keyframes shake {
  0%, 100% { transform: translate(0, 0); }
  20% { transform: translate(-5px, 2px); }
  40% { transform: translate(5px, -2px); }
  60% { transform: translate(-4px, -1px); }
  80% { transform: translate(4px, 1px); }
}
@media (prefers-reduced-motion: reduce) {
  .stage--shake { animation: none; }
}
</style>
