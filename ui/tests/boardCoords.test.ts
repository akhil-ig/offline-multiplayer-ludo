import { describe, expect, it } from 'vitest'
import {
  CENTER_BOUNDS,
  COLORS,
  GOAL,
  GOAL_CELL,
  GRID_SIZE,
  HOME_LANE,
  LANE_START,
  SAFE_TRACK_INDICES,
  STAR_TRACK_INDICES,
  START_OFFSET,
  TRACK,
  TRACK_END,
  TRACK_LENGTH,
  YARD,
  YARD_BOUNDS,
  YARD_SLOTS,
  allCells,
  cellForToken,
  cellKey,
  describeCell,
  isSafePos,
  sameCell,
  trackIndex,
  type Cell,
} from '../src/engine'

const adjacent = (a: Cell, b: Cell) => Math.abs(a.row - b.row) <= 1 && Math.abs(a.col - b.col) <= 1 && !sameCell(a, b)

describe('perimeter track', () => {
  it('has exactly 52 unique in-bounds cells', () => {
    expect(TRACK).toHaveLength(TRACK_LENGTH)
    const keys = new Set(TRACK.map(cellKey))
    expect(keys.size).toBe(52)
    for (const c of TRACK) {
      expect(c.row).toBeGreaterThanOrEqual(1)
      expect(c.row).toBeLessThanOrEqual(GRID_SIZE)
      expect(c.col).toBeGreaterThanOrEqual(1)
      expect(c.col).toBeLessThanOrEqual(GRID_SIZE)
    }
  })

  it('is continuous, including the wrap from 51 back to 0', () => {
    for (let i = 0; i < TRACK_LENGTH; i++) {
      expect(adjacent(TRACK[i], TRACK[(i + 1) % TRACK_LENGTH]), `step ${i}`).toBe(true)
    }
  })

  it('places the four start squares where the spec says', () => {
    expect(TRACK[START_OFFSET.red]).toEqual({ row: 7, col: 2 })
    expect(TRACK[START_OFFSET.green]).toEqual({ row: 2, col: 9 })
    expect(TRACK[START_OFFSET.yellow]).toEqual({ row: 9, col: 14 })
    expect(TRACK[START_OFFSET.blue]).toEqual({ row: 14, col: 7 })
  })

  it('places the four star squares 8 steps after each start', () => {
    expect(STAR_TRACK_INDICES).toEqual([8, 21, 34, 47])
    expect(TRACK[8]).toEqual({ row: 3, col: 7 })
    expect(TRACK[21]).toEqual({ row: 7, col: 13 })
    expect(TRACK[34]).toEqual({ row: 13, col: 9 })
    expect(TRACK[47]).toEqual({ row: 9, col: 3 })
  })

  it('has exactly 8 safe cells', () => {
    expect(SAFE_TRACK_INDICES.size).toBe(8)
    expect([...SAFE_TRACK_INDICES].sort((a, b) => a - b)).toEqual([0, 8, 13, 21, 26, 34, 39, 47])
  })
})

describe('home lanes and goals', () => {
  it('match the spec coordinates', () => {
    expect(HOME_LANE.red).toEqual([2, 3, 4, 5, 6].map((col) => ({ row: 8, col })))
    expect(HOME_LANE.green).toEqual([2, 3, 4, 5, 6].map((row) => ({ row, col: 8 })))
    expect(HOME_LANE.yellow).toEqual([14, 13, 12, 11, 10].map((col) => ({ row: 8, col })))
    expect(HOME_LANE.blue).toEqual([14, 13, 12, 11, 10].map((row) => ({ row, col: 8 })))
    expect(GOAL_CELL).toEqual({
      red: { row: 8, col: 7 },
      green: { row: 7, col: 8 },
      yellow: { row: 8, col: 9 },
      blue: { row: 9, col: 8 },
    })
  })

  it.each(COLORS)('%s lane is reachable from the last track cell and leads to the goal', (color) => {
    const lastTrack = TRACK[(START_OFFSET[color] + TRACK_END) % TRACK_LENGTH]
    const lane = HOME_LANE[color]
    expect(adjacent(lastTrack, lane[0])).toBe(true)
    for (let i = 0; i < lane.length - 1; i++) expect(adjacent(lane[i], lane[i + 1])).toBe(true)
    expect(adjacent(lane[lane.length - 1], GOAL_CELL[color])).toBe(true)
  })
})

describe('board partition', () => {
  it('classifies all 225 cells into yard/center/lane/track with the right counts', () => {
    const counts = { yard: 0, center: 0, lane: 0, track: 0 }
    for (const cell of allCells()) counts[describeCell(cell).kind]++
    expect(counts).toEqual({ yard: 144, center: 9, lane: 20, track: 52 })
  })

  it('never puts a track cell inside a yard, lane, or the centre', () => {
    for (const c of TRACK) expect(describeCell(c).kind).toBe('track')
  })

  it('describes start, star, neutral, lane, yard and centre cells', () => {
    const start = describeCell(TRACK[START_OFFSET.green])
    expect(start).toMatchObject({ kind: 'track', color: 'green', isStart: true, isSafe: true, trackIndex: 13 })
    const star = describeCell(TRACK[21])
    expect(star).toMatchObject({ kind: 'track', isStar: true, isSafe: true })
    expect(star.color).toBeUndefined()
    const neutral = describeCell(TRACK[1])
    expect(neutral).toMatchObject({ kind: 'track', isStart: false, isStar: false, isSafe: false })
    expect(describeCell(HOME_LANE.blue[2])).toMatchObject({ kind: 'lane', color: 'blue' })
    expect(describeCell({ row: 3, col: 3 })).toMatchObject({ kind: 'yard', color: 'red' })
    expect(describeCell({ row: 8, col: 8 })).toMatchObject({ kind: 'center' })
    expect(CENTER_BOUNDS).toEqual({ rowStart: 7, rowEnd: 9, colStart: 7, colEnd: 9 })
  })

  it('rejects cells outside the grid', () => {
    expect(() => describeCell({ row: 0, col: 0 })).toThrow(RangeError)
    expect(() => describeCell({ row: 16, col: 8 })).toThrow(RangeError)
  })
})

describe('cellForToken', () => {
  it.each(COLORS)('%s yard slots are inside the yard and unique', (color) => {
    const b = YARD_BOUNDS[color]
    const keys = new Set<string>()
    for (let t = 0; t < 4; t++) {
      const c = cellForToken(color, YARD, t)
      expect(c).toEqual(YARD_SLOTS[color][t])
      expect(c.row).toBeGreaterThanOrEqual(b.rowStart)
      expect(c.row).toBeLessThanOrEqual(b.rowEnd)
      expect(c.col).toBeGreaterThanOrEqual(b.colStart)
      expect(c.col).toBeLessThanOrEqual(b.colEnd)
      keys.add(cellKey(c))
    }
    expect(keys.size).toBe(4)
  })

  it.each(COLORS)('%s walks start -> track -> lane -> goal', (color) => {
    expect(cellForToken(color, 0, 0)).toEqual(TRACK[START_OFFSET[color]])
    expect(cellForToken(color, TRACK_END, 0)).toEqual(TRACK[(START_OFFSET[color] + TRACK_END) % TRACK_LENGTH])
    expect(cellForToken(color, LANE_START, 0)).toEqual(HOME_LANE[color][0])
    expect(cellForToken(color, LANE_START + 4, 0)).toEqual(HOME_LANE[color][4])
    expect(cellForToken(color, GOAL, 0)).toEqual(GOAL_CELL[color])
  })

  it('every step of a full journey moves to an adjacent cell', () => {
    for (const color of COLORS) {
      for (let pos = 0; pos < GOAL; pos++) {
        expect(adjacent(cellForToken(color, pos, 0), cellForToken(color, pos + 1, 0)), `${color} ${pos}`).toBe(true)
      }
    }
  })

  it('rejects invalid positions and token indices', () => {
    expect(() => cellForToken('red', 57, 0)).toThrow(RangeError)
    expect(() => cellForToken('red', -2, 0)).toThrow(RangeError)
    expect(() => cellForToken('red', YARD, 4)).toThrow(RangeError)
    expect(() => trackIndex('red', 51)).toThrow(RangeError)
  })
})

describe('safety', () => {
  it.each(COLORS)('%s start and star positions are safe, the next cell is not', (color) => {
    expect(isSafePos(color, 0)).toBe(true)
    expect(isSafePos(color, 8)).toBe(true)
    expect(isSafePos(color, 1)).toBe(false)
    expect(isSafePos(color, LANE_START)).toBe(false)
    expect(isSafePos(color, YARD)).toBe(false)
  })
})
