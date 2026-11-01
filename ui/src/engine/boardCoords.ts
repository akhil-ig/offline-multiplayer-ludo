/**
 * Deterministic 15x15 coordinate engine.
 * All coordinates are 1-indexed (row 1..15, col 1..15) to map directly onto
 * CSS Grid `grid-row` / `grid-column`.
 */
import {
  COLORS,
  GOAL,
  LANE_END,
  LANE_START,
  TOKENS_PER_PLAYER,
  TRACK_END,
  TRACK_START,
  YARD,
  type PlayerColor,
  type TokenPos,
} from './types'

export interface Cell {
  row: number
  col: number
}

export const GRID_SIZE = 15
export const TRACK_LENGTH = 52
export const LANE_LENGTH = 5

/** Index on the shared track where each colour enters. */
export const START_OFFSET: Readonly<Record<PlayerColor, number>> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
}

/** Builds the 52-cell clockwise perimeter track starting at Red's start cell (7,2). */
function buildTrack(): Cell[] {
  const t: Cell[] = []
  const push = (row: number, col: number) => t.push({ row, col })
  for (let c = 2; c <= 6; c++) push(7, c) // 0..4   red arm, heading right
  for (let r = 6; r >= 1; r--) push(r, 7) // 5..10  up the left side of the top arm
  push(1, 8) // 11
  push(1, 9) // 12
  for (let r = 2; r <= 6; r++) push(r, 9) // 13..17 green arm, heading down
  for (let c = 10; c <= 15; c++) push(7, c) // 18..23 right along the top of the right arm
  push(8, 15) // 24
  push(9, 15) // 25
  for (let c = 14; c >= 10; c--) push(9, c) // 26..30 yellow arm, heading left
  for (let r = 10; r <= 15; r++) push(r, 9) // 31..36 down the right side of the bottom arm
  push(15, 8) // 37
  push(15, 7) // 38
  for (let r = 14; r >= 10; r--) push(r, 7) // 39..43 blue arm, heading up
  for (let c = 6; c >= 1; c--) push(9, c) // 44..49 left along the bottom of the left arm
  push(8, 1) // 50
  push(7, 1) // 51
  return t
}

export const TRACK: readonly Cell[] = Object.freeze(buildTrack())

/** The four star cells (8 steps after each start). */
export const STAR_TRACK_INDICES: readonly number[] = COLORS.map((c) => (START_OFFSET[c] + 8) % TRACK_LENGTH)

/** Start cells + star cells. No capture may happen here. */
export const SAFE_TRACK_INDICES: ReadonlySet<number> = new Set([
  ...COLORS.map((c) => START_OFFSET[c]),
  ...STAR_TRACK_INDICES,
])

/** Each colour's 5-cell private lane leading into the centre, in walking order. */
export const HOME_LANE: Readonly<Record<PlayerColor, readonly Cell[]>> = {
  red: [2, 3, 4, 5, 6].map((col) => ({ row: 8, col })),
  green: [2, 3, 4, 5, 6].map((row) => ({ row, col: 8 })),
  yellow: [14, 13, 12, 11, 10].map((col) => ({ row: 8, col })),
  blue: [14, 13, 12, 11, 10].map((row) => ({ row, col: 8 })),
}

/** Where a finished token rests inside the 3x3 centre hub. */
export const GOAL_CELL: Readonly<Record<PlayerColor, Cell>> = {
  red: { row: 8, col: 7 },
  green: { row: 7, col: 8 },
  yellow: { row: 8, col: 9 },
  blue: { row: 9, col: 8 },
}

export interface Bounds {
  rowStart: number
  rowEnd: number
  colStart: number
  colEnd: number
}

/** 6x6 yard corners. */
export const YARD_BOUNDS: Readonly<Record<PlayerColor, Bounds>> = {
  red: { rowStart: 1, rowEnd: 6, colStart: 1, colEnd: 6 },
  green: { rowStart: 1, rowEnd: 6, colStart: 10, colEnd: 15 },
  yellow: { rowStart: 10, rowEnd: 15, colStart: 10, colEnd: 15 },
  blue: { rowStart: 10, rowEnd: 15, colStart: 1, colEnd: 6 },
}

function yardSlots(color: PlayerColor): readonly Cell[] {
  const b = YARD_BOUNDS[color]
  const r0 = b.rowStart + 1
  const c0 = b.colStart + 1
  return [
    { row: r0, col: c0 },
    { row: r0, col: c0 + 3 },
    { row: r0 + 3, col: c0 },
    { row: r0 + 3, col: c0 + 3 },
  ]
}

/** The 4 resting slots inside each yard, in token-index order. */
export const YARD_SLOTS: Readonly<Record<PlayerColor, readonly Cell[]>> = {
  red: yardSlots('red'),
  green: yardSlots('green'),
  yellow: yardSlots('yellow'),
  blue: yardSlots('blue'),
}

export const CENTER_BOUNDS: Bounds = { rowStart: 7, rowEnd: 9, colStart: 7, colEnd: 9 }

export function cellKey(cell: Cell): string {
  return `${cell.row},${cell.col}`
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a.row === b.row && a.col === b.col
}

export function isOnTrack(pos: TokenPos): boolean {
  return pos >= TRACK_START && pos <= TRACK_END
}

export function isInLane(pos: TokenPos): boolean {
  return pos >= LANE_START && pos <= LANE_END
}

/** Absolute index on the shared track for a relative track position. */
export function trackIndex(color: PlayerColor, pos: TokenPos): number {
  if (!isOnTrack(pos)) throw new RangeError(`pos ${pos} is not on the track`)
  return (START_OFFSET[color] + pos) % TRACK_LENGTH
}

export function isSafeTrackIndex(index: number): boolean {
  return SAFE_TRACK_INDICES.has(index)
}

/** Whether a relative position for this colour sits on a safe cell. */
export function isSafePos(color: PlayerColor, pos: TokenPos): boolean {
  return isOnTrack(pos) && isSafeTrackIndex(trackIndex(color, pos))
}

/** Resolves a token's logical position to the grid cell it is drawn in. */
export function cellForToken(color: PlayerColor, pos: TokenPos, tokenIndex: number): Cell {
  if (pos === YARD) {
    if (tokenIndex < 0 || tokenIndex >= TOKENS_PER_PLAYER) {
      throw new RangeError(`tokenIndex ${tokenIndex} out of range`)
    }
    return YARD_SLOTS[color][tokenIndex]
  }
  if (isOnTrack(pos)) return TRACK[trackIndex(color, pos)]
  if (isInLane(pos)) return HOME_LANE[color][pos - LANE_START]
  if (pos === GOAL) return GOAL_CELL[color]
  throw new RangeError(`invalid token position ${pos}`)
}

export type CellKind = 'yard' | 'track' | 'lane' | 'center'

export interface CellInfo {
  kind: CellKind
  /** Colour of the yard, lane, or start cell. Undefined for neutral track cells. */
  color?: PlayerColor
  /** Absolute track index for track cells. */
  trackIndex?: number
  isStart: boolean
  isStar: boolean
  isSafe: boolean
}

function inBounds(cell: Cell, b: Bounds): boolean {
  return cell.row >= b.rowStart && cell.row <= b.rowEnd && cell.col >= b.colStart && cell.col <= b.colEnd
}

const TRACK_INDEX_BY_KEY: ReadonlyMap<string, number> = new Map(TRACK.map((c, i) => [cellKey(c), i]))

const LANE_COLOR_BY_KEY: ReadonlyMap<string, PlayerColor> = new Map(
  COLORS.flatMap((color) => HOME_LANE[color].map((c) => [cellKey(c), color] as const)),
)

const START_COLOR_BY_INDEX: ReadonlyMap<number, PlayerColor> = new Map(COLORS.map((c) => [START_OFFSET[c], c]))

/** Describes any of the 225 grid cells. */
export function describeCell(cell: Cell): CellInfo {
  const none = { isStart: false, isStar: false, isSafe: false }
  for (const color of COLORS) {
    if (inBounds(cell, YARD_BOUNDS[color])) return { kind: 'yard', color, ...none }
  }
  if (inBounds(cell, CENTER_BOUNDS)) return { kind: 'center', ...none }
  const laneColor = LANE_COLOR_BY_KEY.get(cellKey(cell))
  if (laneColor) return { kind: 'lane', color: laneColor, ...none }
  const idx = TRACK_INDEX_BY_KEY.get(cellKey(cell))
  if (idx === undefined) throw new RangeError(`cell ${cellKey(cell)} is not part of the board`)
  const startColor = START_COLOR_BY_INDEX.get(idx)
  const isStar = STAR_TRACK_INDICES.includes(idx)
  const info: CellInfo = {
    kind: 'track',
    trackIndex: idx,
    isStart: startColor !== undefined,
    isStar,
    isSafe: isSafeTrackIndex(idx),
  }
  if (startColor) info.color = startColor
  return info
}

/** Every cell of the 15x15 grid, row-major. */
export function allCells(): Cell[] {
  const cells: Cell[] = []
  for (let row = 1; row <= GRID_SIZE; row++) {
    for (let col = 1; col <= GRID_SIZE; col++) cells.push({ row, col })
  }
  return cells
}
