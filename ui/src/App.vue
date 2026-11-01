<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import { useSettingsStore } from '@/stores/settings'
import { useGameFlow } from '@/composables/useGameFlow'
import { useAnimStore } from '@/stores/anim'
import { useFeedback } from '@/composables/useFeedback'
import LudoBoard from '@/components/board/LudoBoard.vue'
import PlayerCard from '@/components/hud/PlayerCard.vue'
import TopBar from '@/components/hud/TopBar.vue'
import ToastStack from '@/components/hud/ToastStack.vue'
import WinScreen from '@/components/hud/WinScreen.vue'
import DebugToolbar from '@/components/hud/DebugToolbar.vue'
import EventBanner from '@/components/hud/EventBanner.vue'
import SetupScreen from '@/components/screens/SetupScreen.vue'
import type { NewPlayerSpec, PlayerColor } from '@/engine'

const game = useGameStore()
const settings = useSettingsStore()
const flow = useGameFlow()
const anim = useAnimStore()
useFeedback()

type Screen = 'setup' | 'game'
const screen = ref<Screen>('setup')

function start(players: NewPlayerSpec[]) {
  anim.trigger('tap')
  game.newGame({
    players,
    settings: { blockingRule: settings.blockingRule, endAtFirstWinner: settings.endAtFirstWinner, autoMoveSingle: settings.autoMoveSingle },
  })
  screen.value = 'game'
}

function resume() {
  if (game.resume()) screen.value = 'game'
}

/** Rematch with the same seats, names and bots as the game that just ended. */
function again() {
  const players: NewPlayerSpec[] = game.players.map((p) => ({ color: p.color, name: p.name, isBot: p.isBot }))
  if (players.length) start(players)
  else toMenu()
}

function toMenu() {
  flow.cancel()
  game.quit()
  screen.value = 'setup'
}

const seat = (color: PlayerColor) => computed(() => game.playerByColor(color))
const red = seat('red')
const green = seat('green')
const yellow = seat('yellow')
const blue = seat('blue')
const activeColor = computed(() => game.current?.color ?? null)

const cardProps = (color: PlayerColor) => ({
  active: activeColor.value === color,
  dice: activeColor.value === color ? game.dice : null,
  canRoll: activeColor.value === color && flow.canRoll.value,
  rolling: activeColor.value === color && flow.rolling.value,
})
</script>

<template>
  <SetupScreen
    v-if="screen === 'setup'"
    :can-resume="game.hasSave"
    @start="start"
    @resume="resume"
  />

  <div
    v-else
    class="app"
    :data-phase="game.phase"
    :data-busy="flow.busy.value"
    :data-turn="activeColor"
  >
    <TopBar
      mode="pass-play"
      :sound="settings.sound"
      :haptics="settings.haptics"
      @toggle-sound="settings.sound = !settings.sound"
      @toggle-haptics="settings.haptics = !settings.haptics"
      @open-room="toMenu"
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
      :can-roll="flow.canRoll.value"
      @force="flow.rollForced"
    />

    <WinScreen
      v-if="game.isOver && game.state"
      :ranking="game.state.ranking"
      :players="game.players"
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
  gap: 0.6rem;
}
.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
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
