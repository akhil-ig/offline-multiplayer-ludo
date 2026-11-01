import { computed, onBeforeUnmount, ref } from 'vue'
import type { GameEvent } from '@/engine'
import { useGameStore } from '@/stores/game'
import { useSettingsStore } from '@/stores/settings'
import { pushToast } from './useToast'

export const DICE_ROLL_MS = 450
const AUTO_MOVE_DELAY_MS = 420
const CAPITAL = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * Drives a local (pass-and-play) game: dice timing, auto-move of a lone legal
 * token, and user-facing toasts for notable events. Animation and audio hook
 * into the same store events separately.
 */
export function useGameFlow() {
  const game = useGameStore()
  const settings = useSettingsStore()
  const rolling = ref(false)
  const busy = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  const canRoll = computed(() => !!game.state && game.phase === 'roll' && !rolling.value && !busy.value)
  const movable = computed(() => (game.phase === 'move' && !busy.value ? game.legalMoves : []))

  function later(ms: number, fn: () => void) {
    timer = setTimeout(fn, ms)
  }

  function nameOf(color: string): string {
    return game.playerByColor(color as never)?.name ?? CAPITAL(color)
  }

  function announce(events: GameEvent[]) {
    for (const e of events) {
      switch (e.type) {
        case 'threeSixes':
          pushToast('Oops! Three 6s in a row', 'danger', '😵')
          break
        case 'noMoves':
          pushToast(`${nameOf(e.player)} has no move`, 'info', '🙅')
          break
        case 'captured':
          pushToast(`${nameOf(e.attacker)} captured ${nameOf(e.victim)}!`, 'danger', '💥')
          break
        case 'bonusRoll':
          pushToast('Extra turn!', 'success', '🔥')
          break
        case 'reachedGoal':
          pushToast(`${nameOf(e.player)} token reached home`, 'success', '🏠')
          break
        case 'finished':
          if (e.rank === 1) pushToast(`${nameOf(e.player)} wins!`, 'success', '🏆', 2500)
          break
        default:
          break
      }
    }
  }

  function afterStateChange() {
    if (!game.state) return
    if (game.phase === 'move' && settings.autoMoveSingle && game.legalMoves.length === 1) {
      busy.value = true
      later(AUTO_MOVE_DELAY_MS, () => {
        busy.value = false
        const only = game.legalMoves[0]
        if (game.phase === 'move' && only !== undefined) doMove(only)
      })
    }
  }

  function applyRoll(value?: number) {
    if (!canRoll.value) return
    rolling.value = true
    later(DICE_ROLL_MS, () => {
      rolling.value = false
      const events = value === undefined ? game.roll() : game.rollForced(value)
      announce(events)
      afterStateChange()
    })
  }

  function roll() {
    applyRoll()
  }

  function rollForced(value: number) {
    applyRoll(value)
  }

  function doMove(tokenIdx: number) {
    if (game.phase !== 'move' || busy.value) return
    if (!game.legalMoves.includes(tokenIdx)) return
    const events = game.move(tokenIdx)
    announce(events)
    afterStateChange()
  }

  function cancel() {
    if (timer) clearTimeout(timer)
    timer = null
    rolling.value = false
    busy.value = false
  }

  onBeforeUnmount(cancel)

  return { rolling, busy, canRoll, movable, roll, rollForced, move: doMove, cancel }
}
