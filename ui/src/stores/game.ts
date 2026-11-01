import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  createGame,
  currentPlayer as enginCurrentPlayer,
  type GameState,
  type NewGameOptions,
  type Player,
  type PlayerColor,
} from '@/engine'

export const useGameStore = defineStore('game', () => {
  const state = ref<GameState | null>(null)

  const players = computed<Player[]>(() => state.value?.players ?? [])
  const current = computed<Player | null>(() => (state.value ? enginCurrentPlayer(state.value) : null))
  const phase = computed(() => state.value?.phase ?? null)

  function playerByColor(color: PlayerColor): Player | undefined {
    return players.value.find((p) => p.color === color)
  }

  function newGame(opts: NewGameOptions): void {
    state.value = createGame(opts)
  }

  return { state, players, current, phase, playerByColor, newGame }
})
