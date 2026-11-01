import { computed, onBeforeUnmount, ref } from 'vue'
import { chooseMove, type GameEvent, type GameState, type PlayerColor } from '@/engine'
import { useGameStore } from '@/stores/game'
import { useSettingsStore } from '@/stores/settings'
import { useAnimStore } from '@/stores/anim'
import { useNetStore, type RemoteStateMsg } from '@/stores/net'
import { useI18n } from '@/i18n'
import { TURBO } from '@/utils/env'
import type { IntentAction } from '@/net/protocol'
import { pushToast } from './useToast'

const SPEED = TURBO ? 0 : 1
export const DICE_ROLL_MS = 450 * SPEED
const AUTO_MOVE_DELAY_MS = 380 * SPEED
const BOT_ROLL_DELAY_MS = 650 * SPEED
const BOT_MOVE_DELAY_MS = 420 * SPEED

/**
 * Drives a game in any mode:
 *  - pass & play: every seat is local
 *  - LAN host: the engine runs here; own seat + bots are local, other seats send intents
 *  - LAN joiner: no engine calls; taps become intents, state arrives from the host
 * Dice timing, animation playback, lone-move auto play and bots all live here.
 */
export function useGameFlow() {
  const game = useGameStore()
  const settings = useSettingsStore()
  const anim = useAnimStore()
  const net = useNetStore()
  const { t, displayName } = useI18n()
  const rolling = ref(false)
  const waiting = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null
  let remoteQueue: Promise<void> = Promise.resolve()

  const busy = computed(() => rolling.value || waiting.value || anim.busy)
  const botTurn = computed(() => game.current?.isBot ?? false)

  /** Whether the seat on turn is controlled by a human on this device. */
  const localHumanTurn = computed(() => {
    const me = game.current
    if (!me || me.isBot) return false
    if (net.mode === 'off') return true
    return me.color === net.myColor
  })

  const canRoll = computed(() => !!game.state && game.phase === 'roll' && !busy.value && localHumanTurn.value)
  const movable = computed(() => (game.phase === 'move' && !busy.value && localHumanTurn.value ? game.legalMoves : []))

  function later(ms: number, fn: () => void) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(fn, ms)
  }

  function nameOf(color: PlayerColor): string {
    return displayName(game.playerByColor(color))
  }

  function announce(events: GameEvent[]) {
    for (const e of events) {
      switch (e.type) {
        case 'noMoves':
          pushToast(t('noMove', { name: nameOf(e.player) }), 'info', '🙅')
          break
        case 'captured':
          pushToast(t('captured', { a: nameOf(e.attacker), b: nameOf(e.victim) }), 'danger', '💥')
          break
        case 'reachedGoal':
          pushToast(t('reachedHome', { name: nameOf(e.player) }), 'success', '🏠')
          break
        case 'finished':
          if (e.rank > 1) pushToast(t('finishedRank', { name: nameOf(e.player), rank: e.rank }), 'info', '🏁')
          break
        default:
          break
      }
    }
  }

  // ---- engine-side (pass & play, LAN host) --------------------------------

  async function perform(step: (prev: GameState) => GameEvent[]) {
    const prev = game.state
    if (!prev) return
    const events = step(prev)
    anim.prepare(events, prev)
    await anim.play(events, nameOf)
    announce(events)
    afterStateChange()
  }

  /** Decides what happens next without user input: lone-move auto play, then bot seats. */
  function afterStateChange() {
    if (!game.state || game.isOver || net.mode === 'join') return
    if (game.phase === 'move' && game.legalMoves.length === 1 && (settings.autoMoveSingle || botTurn.value)) {
      waiting.value = true
      later(AUTO_MOVE_DELAY_MS, () => {
        waiting.value = false
        const only = game.legalMoves[0]
        if (game.phase === 'move' && only !== undefined) void doMove(only)
      })
      return
    }
    if (botTurn.value) {
      waiting.value = true
      if (game.phase === 'roll') {
        later(BOT_ROLL_DELAY_MS, () => {
          waiting.value = false
          startRoll()
        })
      } else if (game.phase === 'move') {
        later(BOT_MOVE_DELAY_MS, () => {
          waiting.value = false
          const pick = game.state ? chooseMove(game.state) : null
          if (pick !== null) void doMove(pick)
        })
      } else {
        waiting.value = false
      }
    }
  }

  function startRoll(value?: number) {
    if (!game.state || game.phase !== 'roll' || rolling.value || anim.busy) return
    rolling.value = true
    anim.trigger('dice')
    if (net.isHost && game.current) net.sendHint(game.current.color)
    later(DICE_ROLL_MS, () => {
      rolling.value = false
      void perform(() => (value === undefined ? game.roll() : game.rollForced(value)))
    })
  }

  async function doMove(tokenIdx: number) {
    if (game.phase !== 'move' || rolling.value || anim.busy) return
    if (!game.legalMoves.includes(tokenIdx)) return
    await perform(() => game.move(tokenIdx))
  }

  // ---- human input ----------------------------------------------------------

  function roll() {
    if (!canRoll.value) return
    if (net.mode === 'join') {
      rolling.value = true
      anim.trigger('dice')
      net.sendIntent('roll')
      return
    }
    startRoll()
  }

  function move(tokenIdx: number) {
    if (!movable.value.includes(tokenIdx)) return
    if (net.mode === 'join') {
      net.sendIntent('move', tokenIdx)
      return
    }
    void doMove(tokenIdx)
  }

  /** Debug: forced roll for whichever seat is on turn (bots included). Host/local only. */
  function rollForced(value: number) {
    if (busy.value || net.mode === 'join') return
    startRoll(value)
  }

  // ---- LAN host: intents from joiners -------------------------------------

  function onIntent(from: string, action: IntentAction, token?: number) {
    const color = net.colorOf(from)
    const me = game.current
    if (!color || !me || me.color !== color || me.isBot || busy.value) return
    if (action === 'roll' && game.phase === 'roll') startRoll()
    else if (action === 'move' && game.phase === 'move' && token !== undefined) void doMove(token)
  }

  // ---- LAN joiner: state from the host -------------------------------------

  function onRemoteState(msg: RemoteStateMsg) {
    remoteQueue = remoteQueue.then(async () => {
      rolling.value = false
      const prev = game.state
      const sameGame = prev !== null && msg.events.length > 0
      if (sameGame) anim.prepare(msg.events, prev)
      game.applyRemote(msg.state, msg.events)
      if (sameGame) await anim.play(msg.events, nameOf)
      announce(msg.events)
    })
  }

  function onHint() {
    rolling.value = true
    anim.trigger('dice')
    // Safety valve: the host's state follows within a second; never stay stuck tumbling.
    later(DICE_ROLL_MS + 1500 * SPEED, () => (rolling.value = false))
  }

  const unsubscribe = game.subscribe((events, state) => {
    if (net.isHost) net.broadcastState(state, events)
  })
  net.bind({ onIntent, onRemoteState, onHint })

  /** Call after starting or resuming a game so a bot on turn starts playing. */
  function kick() {
    afterStateChange()
  }

  function cancel() {
    if (timer) clearTimeout(timer)
    timer = null
    rolling.value = false
    waiting.value = false
    anim.reset()
  }

  onBeforeUnmount(() => {
    cancel()
    unsubscribe()
    net.bind({})
  })

  return { rolling, busy, botTurn, localHumanTurn, canRoll, movable, roll, rollForced, move, kick, cancel }
}
