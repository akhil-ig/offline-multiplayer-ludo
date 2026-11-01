/**
 * Core domain types for the Ludo engine.
 * The engine is pure: no DOM, no Vue, no side effects.
 */

export type PlayerColor = 'red' | 'green' | 'yellow' | 'blue'

/** Turn order is clockwise around the board. */
export const COLORS: readonly PlayerColor[] = ['red', 'green', 'yellow', 'blue'] as const

/**
 * Token position model (relative to the owning player's start cell):
 *  -1      -> in the home yard
 *  0..50   -> on the shared 52-cell perimeter track
 *  51..55  -> in the player's private home lane (5 cells)
 *  56      -> goal (centre hub)
 */
export type TokenPos = number
export const YARD = -1
export const TRACK_START = 0
export const TRACK_END = 50
export const LANE_START = 51
export const LANE_END = 55
export const GOAL = 56
export const TOKENS_PER_PLAYER = 4

export interface Player {
  color: PlayerColor
  name: string
  isBot: boolean
  tokens: TokenPos[]
  /** 1-based finishing rank, null while still playing. */
  rank: number | null
}

export interface GameSettings {
  /** Two or more same-colour tokens on a non-safe cell form a block nobody may land on or pass. */
  blockingRule: boolean
  /** End the game as soon as the first player gets all four tokens home. */
  endAtFirstWinner: boolean
  /** UI hint: automatically play the move when exactly one is legal. */
  autoMoveSingle: boolean
}

export const DEFAULT_SETTINGS: GameSettings = {
  blockingRule: false,
  endAtFirstWinner: false,
  autoMoveSingle: true,
}

export type Phase = 'roll' | 'move' | 'over'

export interface GameState {
  readonly version: 1
  players: Player[]
  /** Index into `players` of the player whose turn it is. */
  current: number
  phase: Phase
  /** Last rolled value while in the `move` phase; null otherwise. */
  dice: number | null
  /** Consecutive sixes rolled by the current player this turn. */
  sixStreak: number
  /** Monotonic counter, incremented on every roll. Useful for UI keys and replays. */
  turn: number
  settings: GameSettings
  /** Seeded RNG state. The engine never calls Math.random. */
  rngState: number
  /** Colours in finishing order. */
  ranking: PlayerColor[]
}

export type BonusReason = 'six' | 'capture' | 'goal'

export type GameEvent =
  | { type: 'rolled'; player: PlayerColor; value: number }
  | { type: 'unlocked'; player: PlayerColor; token: number }
  | { type: 'moved'; player: PlayerColor; token: number; from: TokenPos; to: TokenPos }
  | { type: 'captured'; attacker: PlayerColor; victim: PlayerColor; token: number; fromPos: TokenPos }
  | { type: 'reachedGoal'; player: PlayerColor; token: number }
  | { type: 'bonusRoll'; player: PlayerColor; reason: BonusReason }
  | { type: 'threeSixes'; player: PlayerColor }
  | { type: 'noMoves'; player: PlayerColor }
  | { type: 'turnChanged'; player: PlayerColor }
  | { type: 'finished'; player: PlayerColor; rank: number }
  | { type: 'gameOver'; ranking: PlayerColor[] }

export interface StepResult {
  state: GameState
  events: GameEvent[]
}

export interface NewPlayerSpec {
  color: PlayerColor
  name?: string
  isBot?: boolean
}

export interface NewGameOptions {
  players: NewPlayerSpec[]
  seed?: number
  settings?: Partial<GameSettings>
}
