import { describe, expect, it } from 'vitest'
import { nextFloat, nextInt, randomSeed, rollDie } from '../src/engine'

describe('seeded rng', () => {
  it('is deterministic for the same seed', () => {
    const a = Array.from({ length: 20 }, (_, i) => rollDie(42 + i).value)
    const b = Array.from({ length: 20 }, (_, i) => rollDie(42 + i).value)
    expect(a).toEqual(b)
  })

  it('advances state on every call', () => {
    const r1 = rollDie(1)
    const r2 = rollDie(r1.state)
    expect(r2.state).not.toBe(r1.state)
  })

  it('produces floats in [0,1)', () => {
    let state = 7
    for (let i = 0; i < 1000; i++) {
      const r = nextFloat(state)
      expect(r.value).toBeGreaterThanOrEqual(0)
      expect(r.value).toBeLessThan(1)
      state = r.state
    }
  })

  it('rolls every face with a roughly uniform distribution', () => {
    const counts = new Map<number, number>()
    let state = 12345
    const N = 12000
    for (let i = 0; i < N; i++) {
      const r = rollDie(state)
      expect(r.value).toBeGreaterThanOrEqual(1)
      expect(r.value).toBeLessThanOrEqual(6)
      counts.set(r.value, (counts.get(r.value) ?? 0) + 1)
      state = r.state
    }
    expect(counts.size).toBe(6)
    for (const n of counts.values()) {
      expect(n).toBeGreaterThan(N / 6 - 300)
      expect(n).toBeLessThan(N / 6 + 300)
    }
  })

  it('nextInt respects inclusive bounds', () => {
    let state = 99
    for (let i = 0; i < 500; i++) {
      const r = nextInt(state, 3, 5)
      expect([3, 4, 5]).toContain(r.value)
      state = r.state
    }
  })

  it('randomSeed yields a uint32', () => {
    const s = randomSeed()
    expect(Number.isInteger(s)).toBe(true)
    expect(s).toBeGreaterThanOrEqual(0)
    expect(s).toBeLessThanOrEqual(0xffffffff)
  })
})
