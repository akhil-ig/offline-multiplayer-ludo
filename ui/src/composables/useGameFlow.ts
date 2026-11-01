import { computed, onBeforeUnmount, ref } from 'vue'
import type { GameEvent, GameState, PlayerColor } from '@/engine'
import { useGameStore } from '@/stores/game'
import { useSettingsStore } from '@/stores/settings'
import { useAnimStore } from '@/stores/anim'
import { pushToast } from './useToast'

export const DICE_ROLL_MS = 450
const AUTO_MOVE_DELAY_MS = 380
const CAPITAL = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * Drives a local (pass-and-play) game: dice timing, animation playback,
 * auto-move of a lone legal token, and user-facing toasts.
 */
export function useGameFlow() {
  const game = useGameStore()
  const settings = useSettingsStore()
  const anim = useAnimStore()
  const rolling = ref(false)
  const waiting = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  const busy = computed(() => rolling.value || waiting.value || anim.busy)
  const canRoll = computed(() => !!game.state && game.phase === 'roll' && !busy.value)
  const movable = computed(() => (game.phase === 'move' && !busy.value ? game.legalMoves : []))

  function later(ms: number, fn: () => void) {
    timer = setTimeout(fn, ms)
  }

  function nameOf(color: PlayerColor): string {
    return game.playerByColor(color)?.name ?? CAPITAL(color)
  }

  function announce(events: GameEvent[]) {
    for (const e of events) {
      switch (e.type) {
        case 'noMoves':
          pushToast(`${nameOf(e.player)} has no move`, 'info', '🙅')
          break
        case 'captured':
          pushToast(`${nameOf(e.attacker)} captured ${nameOf(e.victim)}!`, 'danger', '💥')
          break
        case 'reachedGoal':
          pushToast(`${nameOf(e.player)} token reached home`, 'success', '🏠')
          break
        case 'finished':
          if (e.rank > 1) pushToast(`${nameOf(e.player)} finished #${e.rank}`, 'info', '🏁')
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

  function afterStateChange() {
    if (!game.state) return
    if (game.phase === 'move' && settings.autoMoveSingle && game.legalMoves.length === 1) {
      waiting.value = true
      later(AUTO_MOVE_DELAY_MS, () => {
        waiting.value = false
        const only = game.legalMoves[0]
        if (game.phase === 'move' && only !== undefined) void doMove(only)
      })
    }
  }

  function applyRoll(value?: number) {
    if (!canRoll.value) return
    rolling.value = true
    anim.trigger('dice')
    later(DICE_ROLL_MS, () => {
      rolling.value = false
      void perform(() => (value === undefined ? game.roll() : game.rollForced(value)))
    })
  }

  function roll() {
    applyRoll()
  }

  function rollForced(value: number) {
    applyRoll(value)
  }

  async function doMove(tokenIdx: number) {
    if (game.phase !== 'move' || busy.value) return
    if (!game.legalMoves.includes(tokenIdx)) return
    await perform(() => game.move(tokenIdx))
  }

  function cancel() {
    if (timer) clearTimeout(timer)
    timer = null
    rolling.value = false
    waiting.value = false
    anim.reset()
  }

  onBeforeUnmount(cancel)

  return { rolling, busy, canRoll, movable, roll, rollForced, move: doMove, cancel }
}
