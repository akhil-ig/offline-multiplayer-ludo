import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import {
  cloneState,
  createGame,
  currentPlayer as engineCurrentPlayer,
  deserialize,
  legalMoves as engineLegalMoves,
  moveToken as engineMove,
  roll as engineRoll,
  rollForced as engineRollForced,
  serialize,
  type GameEvent,
  type GameState,
  type NewGameOptions,
  type Player,
  type PlayerColor,
  type StepResult,
  type TokenPos,
} from '@/engine'

const SAVE_KEY = 'ludo.game.v1'

export type EventListener = (events: GameEvent[], state: GameState) => void

/**
 * Single source of truth for the running game.
 * Every mutation goes through the pure engine and then fans out the resulting
 * events to subscribers (animation queue, sound, toasts, network).
 * In LAN mode the same store is driven by the host's broadcasts instead of local calls.
 */
export const useGameStore = defineStore('game', () => {
  const state = ref<GameState | null>(null)
  const lastEvents = ref<GameEvent[]>([])
  const listeners = new Set<EventListener>()

  const players = computed<Player[]>(() => state.value?.players ?? [])
  const current = computed<Player | null>(() => (state.value ? engineCurrentPlayer(state.value) : null))
  const phase = computed(() => state.value?.phase ?? null)
  const dice = computed(() => state.value?.dice ?? null)
  const legalMoves = computed<number[]>(() => (state.value ? engineLegalMoves(state.value) : []))
  const isOver = computed(() => state.value?.phase === 'over')
  const hasSave = computed(() => savedGameExists())

  function playerByColor(color: PlayerColor): Player | undefined {
    return players.value.find((p) => p.color === color)
  }

  function subscribe(fn: EventListener): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  function commit(result: StepResult): GameEvent[] {
    state.value = result.state
    lastEvents.value = result.events
    for (const fn of listeners) fn(result.events, result.state)
    return result.events
  }

  function newGame(opts: NewGameOptions): void {
    state.value = createGame(opts)
    lastEvents.value = []
  }

  function roll(): GameEvent[] {
    if (!state.value) throw new Error('no game')
    return commit(engineRoll(state.value))
  }

  function rollForced(value: number): GameEvent[] {
    if (!state.value) throw new Error('no game')
    return commit(engineRollForced(state.value, value))
  }

  function move(tokenIdx: number): GameEvent[] {
    if (!state.value) throw new Error('no game')
    return commit(engineMove(state.value, tokenIdx))
  }

  /** Replaces the whole state, e.g. from a host broadcast. Events are fanned out as given. */
  function applyRemote(next: GameState, events: GameEvent[]): void {
    commit({ state: next, events })
  }

  /** Debug only: overwrite one player's tokens. */
  function debugSetTokens(color: PlayerColor, tokens: TokenPos[]): void {
    if (!state.value) return
    const s = cloneState(state.value)
    const p = s.players.find((x) => x.color === color)
    if (!p) return
    p.tokens = [...tokens]
    state.value = s
  }

  // ---- persistence -------------------------------------------------------

  function savedGameExists(): boolean {
    try {
      return localStorage.getItem(SAVE_KEY) !== null
    } catch {
      return false
    }
  }

  function save(): void {
    try {
      if (state.value && state.value.phase !== 'over') localStorage.setItem(SAVE_KEY, serialize(state.value))
      else localStorage.removeItem(SAVE_KEY)
    } catch {
      /* storage unavailable */
    }
  }

  function resume(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return false
      state.value = deserialize(raw)
      lastEvents.value = []
      return true
    } catch {
      clearSave()
      return false
    }
  }

  function clearSave(): void {
    try {
      localStorage.removeItem(SAVE_KEY)
    } catch {
      /* ignore */
    }
  }

  function quit(): void {
    state.value = null
    lastEvents.value = []
    clearSave()
  }

  watch(state, save, { deep: true })

  return {
    state,
    lastEvents,
    players,
    current,
    phase,
    dice,
    legalMoves,
    isOver,
    hasSave,
    playerByColor,
    subscribe,
    newGame,
    roll,
    rollForced,
    move,
    applyRemote,
    debugSetTokens,
    resume,
    clearSave,
    quit,
  }
})
