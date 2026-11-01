import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import confetti from 'canvas-confetti'
import { YARD, cellForToken, type Cell, type GameEvent, type GameState, type PlayerColor } from '@/engine'
import { TURBO } from '@/utils/env'
import type { I18nKey } from '@/i18n'

export const STEP_MS = 110
export const ZIP_MS = 25
export const UNLOCK_MS = 220
export const SHAKE_MS = 180
export const BANNER_MS = 950

export interface Burst {
  id: number
  cell: Cell
  color: PlayerColor
}

export interface Banner {
  key: I18nKey
  params?: Record<string, string>
  emoji: string
  color: PlayerColor
}

export type AnimHook = 'dice' | 'hop' | 'unlock' | 'capture' | 'zip' | 'goal' | 'land' | 'banner' | 'win' | 'fail' | 'tap'
type HookFn = (detail: { step?: number; color?: PlayerColor }) => void

const tokenKey = (color: PlayerColor, token: number) => `${color}-${token}`
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * Visual layer over the logical game state. The engine updates instantly; this
 * store lags the *displayed* token positions and plays each event as a small
 * choreography (cell-by-cell hops, reverse-zip on capture, shake, particles,
 * banners, confetti). Sound and haptics subscribe to the same hook points.
 */
export const useAnimStore = defineStore('anim', () => {
  const display = reactive<Record<string, number>>({})
  const hopTick = reactive<Record<string, number>>({})
  const zipTick = reactive<Record<string, number>>({})
  const moving = ref<string | null>(null)
  const busy = ref(false)
  const shake = ref(false)
  const banner = ref<Banner | null>(null)
  const bursts = reactive<Burst[]>([])
  const reduced = ref(TURBO || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches))
  const hooks = new Map<AnimHook, Set<HookFn>>()
  let burstId = 1
  let bannerTimer: ReturnType<typeof setTimeout> | null = null

  function on(hook: AnimHook, fn: HookFn): () => void {
    const set = hooks.get(hook) ?? new Set<HookFn>()
    set.add(fn)
    hooks.set(hook, set)
    return () => set.delete(fn)
  }

  function emit(hook: AnimHook, detail: { step?: number; color?: PlayerColor } = {}) {
    hooks.get(hook)?.forEach((fn) => fn(detail))
  }

  /** Pin the tokens touched by `events` to their *previous* positions before the new state renders. */
  function prepare(events: GameEvent[], prev: GameState): void {
    const posOf = (color: PlayerColor, token: number) => prev.players.find((p) => p.color === color)?.tokens[token]
    for (const e of events) {
      if (e.type === 'moved') display[tokenKey(e.player, e.token)] = e.from
      if (e.type === 'captured') display[tokenKey(e.victim, e.token)] = posOf(e.victim, e.token) ?? e.fromPos
    }
  }

  function showBanner(b: Banner) {
    banner.value = b
    emit('banner', { color: b.color })
    if (bannerTimer) clearTimeout(bannerTimer)
    bannerTimer = setTimeout(() => (banner.value = null), BANNER_MS)
  }

  function burstAt(cell: Cell, color: PlayerColor) {
    const id = burstId++
    bursts.push({ id, cell, color })
    setTimeout(() => {
      const i = bursts.findIndex((b) => b.id === id)
      if (i >= 0) bursts.splice(i, 1)
    }, 700)
  }

  function doShake() {
    shake.value = true
    setTimeout(() => (shake.value = false), SHAKE_MS)
  }

  function fireConfetti(big: boolean) {
    if (reduced.value) return
    try {
      confetti({
        particleCount: big ? 160 : 60,
        spread: big ? 90 : 60,
        startVelocity: big ? 45 : 30,
        origin: { y: 0.55 },
        zIndex: 60,
        disableForReducedMotion: true,
      })
    } catch {
      /* canvas unavailable */
    }
  }

  async function playMove(e: Extract<GameEvent, { type: 'moved' }>) {
    const key = tokenKey(e.player, e.token)
    moving.value = key
    if (e.from === YARD) {
      display[key] = 0
      hopTick[key] = (hopTick[key] ?? 0) + 1
      emit('unlock', { color: e.player })
      if (!reduced.value) await sleep(UNLOCK_MS)
    } else {
      for (let p = e.from + 1, step = 0; p <= e.to; p++, step++) {
        display[key] = p
        hopTick[key] = (hopTick[key] ?? 0) + 1
        emit('hop', { step, color: e.player })
        if (!reduced.value) await sleep(STEP_MS)
      }
    }
    emit('land', { color: e.player })
    moving.value = null
  }

  async function playCapture(e: Extract<GameEvent, { type: 'captured' }>) {
    const key = tokenKey(e.victim, e.token)
    const from = display[key] ?? e.fromPos
    emit('capture', { color: e.victim })
    if (!reduced.value) {
      doShake()
      burstAt(cellForToken(e.victim, from, e.token), e.victim)
      await sleep(140)
      for (let p = from - 1; p >= 0; p--) {
        display[key] = p
        zipTick[key] = (zipTick[key] ?? 0) + 1
        emit('zip', { step: from - p, color: e.victim })
        await sleep(ZIP_MS)
      }
    }
    display[key] = YARD
    if (!reduced.value) await sleep(90)
  }

  /** Plays the choreography for one engine step. Resolves when the board is settled. */
  async function play(events: GameEvent[], names: (c: PlayerColor) => string): Promise<void> {
    busy.value = true
    try {
      for (const e of events) {
        switch (e.type) {
          case 'moved':
            await playMove(e)
            break
          case 'captured':
            await playCapture(e)
            break
          case 'reachedGoal':
            emit('goal', { color: e.player })
            fireConfetti(false)
            if (!reduced.value) await sleep(120)
            break
          case 'bonusRoll':
            showBanner(
              e.reason === 'capture'
                ? { key: 'extraTurn', emoji: '🔥', color: e.player }
                : e.reason === 'goal'
                  ? { key: 'homeRun', emoji: '🏠', color: e.player }
                  : { key: 'sixAgain', emoji: '🎲', color: e.player },
            )
            if (!reduced.value) await sleep(260)
            break
          case 'threeSixes':
            emit('fail', { color: e.player })
            showBanner({ key: 'threeSixes', emoji: '😵', color: e.player })
            if (!reduced.value) await sleep(420)
            break
          case 'finished':
            if (e.rank === 1) {
              emit('win', { color: e.player })
              showBanner({ key: 'winsBanner', params: { name: names(e.player) }, emoji: '🏆', color: e.player })
              fireConfetti(true)
              if (!reduced.value) await sleep(500)
            }
            break
          default:
            break
        }
      }
    } finally {
      // Display overrides now equal the logical positions; drop them so the state is the single source again.
      for (const k of Object.keys(display)) delete display[k]
      moving.value = null
      busy.value = false
    }
  }

  function reset() {
    for (const k of Object.keys(display)) delete display[k]
    bursts.splice(0)
    banner.value = null
    moving.value = null
    busy.value = false
    shake.value = false
  }

  return { display, hopTick, zipTick, moving, busy, shake, banner, bursts, reduced, on, trigger: emit, prepare, play, reset }
})
