import { computed, onBeforeUnmount, ref } from 'vue'
import { chooseMove, type GameEvent, type GameState, type PlayerColor } from '@/engine'
import { useGameStore } from '@/stores/game'
import { useSettingsStore } from '@/stores/settings'
import { useAnimStore } from '@/stores/anim'
import { useI18n } from '@/i18n'
import { TURBO } from '@/utils/env'
import { pushToast } from './useToast'

const SPEED = TURBO ? 0 : 1
export const DICE_ROLL_MS = 450 * SPEED
const AUTO_MOVE_DELAY_MS = 380 * SPEED
const BOT_ROLL_DELAY_MS = 650 * SPEED
const BOT_MOVE_DELAY_MS = 420 * SPEED

/**
 * Drives a local (pass-and-play) game: dice timing, animation playback,
 * auto-move of a lone legal token, bot seats, and user-facing toasts.
 */
export function useGameFlow() {
  const game = useGameStore()
  const settings = useSettingsStore()
  const anim = useAnimStore()
  const { t, displayName } = useI18n()
  const rolling = ref(false)
  const waiting = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  const busy = computed(() => rolling.value || waiting.value || anim.busy)
  const botTurn = computed(() => game.current?.isBot ?? false)
  const canRoll = computed(() => !!game.state && game.phase === 'roll' && !busy.value && !botTurn.value)
  const movable = computed(() => (game.phase === 'move' && !busy.value && !botTurn.value ? game.legalMoves : []))

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

  /** Runs an engine step through the animation layer, then toasts and follow-ups. */
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
    if (!game.state || game.isOver) return
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
    later(DICE_ROLL_MS, () => {
      rolling.value = false
      void perform(() => (value === undefined ? game.roll() : game.rollForced(value)))
    })
  }

  /** Human roll from the dice button. */
  function roll() {
    if (canRoll.value) startRoll()
  }

  /** Debug: human-forced roll for whichever seat is on turn (bots included). */
  function rollForced(value: number) {
    if (busy.value) return
    startRoll(value)
  }

  async function doMove(tokenIdx: number) {
    if (game.phase !== 'move' || rolling.value || anim.busy) return
    if (!game.legalMoves.includes(tokenIdx)) return
    await perform(() => game.move(tokenIdx))
  }

  /** Human tap on a token. */
  function move(tokenIdx: number) {
    if (botTurn.value || waiting.value) return
    void doMove(tokenIdx)
  }

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

  onBeforeUnmount(cancel)

  return { rolling, busy, botTurn, canRoll, movable, roll, rollForced, move, kick, cancel }
}
