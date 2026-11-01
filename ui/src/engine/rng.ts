/**
 * Deterministic PRNG (mulberry32). Pure: takes a state, returns a new state.
 * Deterministic dice make the engine replayable and the tests exact.
 */

export interface RngResult {
  value: number
  state: number
}

/** Returns a float in [0, 1) and the next RNG state. */
export function nextFloat(state: number): RngResult {
  let t = (state + 0x6d2b79f5) | 0
  const nextState = t
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return { value, state: nextState }
}

/** Returns an integer in [min, max] inclusive and the next RNG state. */
export function nextInt(state: number, min: number, max: number): RngResult {
  const r = nextFloat(state)
  return { value: min + Math.floor(r.value * (max - min + 1)), state: r.state }
}

/** Standard six-sided die. */
export function rollDie(state: number): RngResult {
  return nextInt(state, 1, 6)
}

/** Produces a seed from the host clock. The only impure function in the engine, and it is opt-in. */
export function randomSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0
}
