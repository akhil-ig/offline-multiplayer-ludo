/**
 * Complete Ludo rules engine. Pure functions: every operation takes a state and
 * returns a new state plus the events that happened, never mutating the input.
 *
 * Rules implemented (see PLAN.md section 3):
 *  - a 6 is required to leave the yard
 *  - bonus roll on a 6, on a capture, and on reaching the goal
 *  - three consecutive sixes forfeit the turn
 *  - exact roll required to reach the goal
 *  - landing on opponents on a non-safe cell captures ALL of them
 *  - optional blocking rule: two same-colour tokens on a non-safe cell cannot be landed on or passed
 *  - play continues until all but one player have finished (or first winner, if configured)
 */
import { isOnTrack, isSafeTrackIndex, trackIndex } from './boardCoords'
import { randomSeed, rollDie } from './rng'
import {
  COLORS,
  DEFAULT_SETTINGS,
  GOAL,
  TOKENS_PER_PLAYER,
  TRACK_END,
  YARD,
  type BonusReason,
  type GameEvent,
  type GameState,
  type NewGameOptions,
  type Player,
  type PlayerColor,
  type StepResult,
  type TokenPos,
} from './types'

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 4

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function createGame(opts: NewGameOptions): GameState {
  const specs = opts.players
  if (specs.length < MIN_PLAYERS || specs.length > MAX_PLAYERS) {
    throw new RangeError(`a game needs ${MIN_PLAYERS} to ${MAX_PLAYERS} players, got ${specs.length}`)
  }
  const seen = new Set<PlayerColor>()
  for (const s of specs) {
    if (!COLORS.includes(s.color)) throw new RangeError(`unknown colour ${String(s.color)}`)
    if (seen.has(s.color)) throw new RangeError(`duplicate colour ${s.color}`)
    seen.add(s.color)
  }
  // Seat players clockwise regardless of the order they were supplied in.
  const ordered = [...specs].sort((a, b) => COLORS.indexOf(a.color) - COLORS.indexOf(b.color))
  const players: Player[] = ordered.map((s) => ({
    color: s.color,
    name: s.name?.trim() || capitalize(s.color),
    isBot: s.isBot ?? false,
    tokens: Array.from({ length: TOKENS_PER_PLAYER }, () => YARD),
    rank: null,
  }))
  return {
    version: 1,
    players,
    current: 0,
    phase: 'roll',
    dice: null,
    sixStreak: 0,
    turn: 0,
    settings: { ...DEFAULT_SETTINGS, ...opts.settings },
    rngState: (opts.seed ?? randomSeed()) >>> 0,
    ranking: [],
  }
}

export function cloneState(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, tokens: [...p.tokens] })),
    settings: { ...state.settings },
    ranking: [...state.ranking],
  }
}

export function currentPlayer(state: GameState): Player {
  return state.players[state.current]
}

export function playerIndex(state: GameState, color: PlayerColor): number {
  return state.players.findIndex((p) => p.color === color)
}

interface TokenRef {
  playerIdx: number
  tokenIdx: number
}

/** All tokens belonging to players other than `playerIdx` sitting on absolute track cell `absIdx`. */
function opponentsAt(state: GameState, playerIdx: number, absIdx: number): TokenRef[] {
  const out: TokenRef[] = []
  state.players.forEach((p, pi) => {
    if (pi === playerIdx) return
    p.tokens.forEach((pos, ti) => {
      if (isOnTrack(pos) && trackIndex(p.color, pos) === absIdx) out.push({ playerIdx: pi, tokenIdx: ti })
    })
  })
  return out
}

/** A block is two or more same-colour opponent tokens on a non-safe track cell. */
function isOpponentBlock(state: GameState, playerIdx: number, absIdx: number): boolean {
  if (isSafeTrackIndex(absIdx)) return false
  const counts = new Map<number, number>()
  for (const ref of opponentsAt(state, playerIdx, absIdx)) {
    counts.set(ref.playerIdx, (counts.get(ref.playerIdx) ?? 0) + 1)
  }
  for (const n of counts.values()) if (n >= 2) return true
  return false
}

/** Whether the given token may move `dice` steps. Independent of phase, so bots and tests can probe. */
export function canMoveToken(state: GameState, playerIdx: number, tokenIdx: number, dice: number): boolean {
  const player = state.players[playerIdx]
  const pos: TokenPos = player.tokens[tokenIdx]
  if (pos === GOAL) return false
  if (pos === YARD) return dice === 6
  const target = pos + dice
  if (target > GOAL) return false
  if (state.settings.blockingRule) {
    const lastTrackStep = Math.min(target, TRACK_END)
    for (let step = pos + 1; step <= lastTrackStep; step++) {
      if (isOpponentBlock(state, playerIdx, trackIndex(player.color, step))) return false
    }
  }
  return true
}

/** Token indices the current player may move with the current dice. Empty outside the `move` phase. */
export function legalMoves(state: GameState): number[] {
  if (state.phase !== 'move' || state.dice === null) return []
  const dice = state.dice
  const moves: number[] = []
  for (let t = 0; t < TOKENS_PER_PLAYER; t++) {
    if (canMoveToken(state, state.current, t, dice)) moves.push(t)
  }
  return moves
}

function advanceTurn(s: GameState, events: GameEvent[]): void {
  const n = s.players.length
  for (let step = 1; step <= n; step++) {
    const idx = (s.current + step) % n
    if (s.players[idx].rank === null) {
      s.current = idx
      break
    }
  }
  s.sixStreak = 0
  s.phase = 'roll'
  s.dice = null
  events.push({ type: 'turnChanged', player: s.players[s.current].color })
}

/**
 * Applies a specific dice value. This is the single code path for real rolls,
 * forced debug rolls, and replays.
 */
export function rollForced(state: GameState, value: number): StepResult {
  if (state.phase !== 'roll') throw new Error(`cannot roll during phase "${state.phase}"`)
  if (!Number.isInteger(value) || value < 1 || value > 6) throw new RangeError(`invalid dice value ${value}`)
  const s = cloneState(state)
  const events: GameEvent[] = []
  const me = s.players[s.current]
  s.turn += 1
  s.dice = value
  events.push({ type: 'rolled', player: me.color, value })

  s.sixStreak = value === 6 ? s.sixStreak + 1 : 0
  if (s.sixStreak >= 3) {
    events.push({ type: 'threeSixes', player: me.color })
    advanceTurn(s, events)
    return { state: s, events }
  }

  s.phase = 'move'
  if (legalMoves(s).length === 0) {
    events.push({ type: 'noMoves', player: me.color })
    s.dice = null
    if (value === 6) {
      // A six always earns another roll, even when nothing could move.
      s.phase = 'roll'
      events.push({ type: 'bonusRoll', player: me.color, reason: 'six' })
    } else {
      advanceTurn(s, events)
    }
  }
  return { state: s, events }
}

/** Rolls the die using the state's seeded RNG. */
export function roll(state: GameState): StepResult {
  if (state.phase !== 'roll') throw new Error(`cannot roll during phase "${state.phase}"`)
  const r = rollDie(state.rngState)
  return rollForced({ ...state, rngState: r.state }, r.value)
}

/** Progress used to rank players who have not finished when the game ends early. */
export function progressScore(player: Player): number {
  return player.tokens.reduce((sum, pos) => sum + (pos === GOAL ? 100 : pos + 1), 0)
}

function finishGame(s: GameState, events: GameEvent[]): void {
  const remaining = s.players
    .filter((p) => p.rank === null)
    .sort((a, b) => progressScore(b) - progressScore(a) || COLORS.indexOf(a.color) - COLORS.indexOf(b.color))
  for (const p of remaining) {
    p.rank = s.ranking.length + 1
    s.ranking.push(p.color)
    events.push({ type: 'finished', player: p.color, rank: p.rank })
  }
  s.phase = 'over'
  s.dice = null
  events.push({ type: 'gameOver', ranking: [...s.ranking] })
}

/** Moves one of the current player's tokens by the rolled dice. */
export function moveToken(state: GameState, tokenIdx: number): StepResult {
  if (state.phase !== 'move' || state.dice === null) throw new Error(`cannot move during phase "${state.phase}"`)
  if (!canMoveToken(state, state.current, tokenIdx, state.dice)) {
    throw new Error(`token ${tokenIdx} has no legal move with a ${state.dice}`)
  }
  const s = cloneState(state)
  const events: GameEvent[] = []
  const dice = s.dice as number
  const me = s.players[s.current]
  const from = me.tokens[tokenIdx]
  const to: TokenPos = from === YARD ? 0 : from + dice

  if (from === YARD) events.push({ type: 'unlocked', player: me.color, token: tokenIdx })
  me.tokens[tokenIdx] = to
  events.push({ type: 'moved', player: me.color, token: tokenIdx, from, to })

  let captured = false
  if (isOnTrack(to)) {
    const abs = trackIndex(me.color, to)
    if (!isSafeTrackIndex(abs)) {
      for (const ref of opponentsAt(s, s.current, abs)) {
        const victim = s.players[ref.playerIdx]
        const fromPos = victim.tokens[ref.tokenIdx]
        victim.tokens[ref.tokenIdx] = YARD
        captured = true
        events.push({ type: 'captured', attacker: me.color, victim: victim.color, token: ref.tokenIdx, fromPos })
      }
    }
  }

  const reachedGoal = to === GOAL
  if (reachedGoal) events.push({ type: 'reachedGoal', player: me.color, token: tokenIdx })

  const finishedNow = me.tokens.every((p) => p === GOAL)
  if (finishedNow) {
    me.rank = s.ranking.length + 1
    s.ranking.push(me.color)
    events.push({ type: 'finished', player: me.color, rank: me.rank })
  }

  const active = s.players.filter((p) => p.rank === null).length
  if ((s.settings.endAtFirstWinner && s.ranking.length >= 1) || active <= 1) {
    finishGame(s, events)
    return { state: s, events }
  }

  s.dice = null
  if (finishedNow) {
    advanceTurn(s, events)
    return { state: s, events }
  }

  let bonus: BonusReason | null = null
  if (captured) bonus = 'capture'
  else if (reachedGoal) bonus = 'goal'
  else if (dice === 6) bonus = 'six'

  if (bonus) {
    s.phase = 'roll'
    events.push({ type: 'bonusRoll', player: me.color, reason: bonus })
  } else {
    advanceTurn(s, events)
  }
  return { state: s, events }
}

export function winner(state: GameState): PlayerColor | null {
  return state.ranking[0] ?? null
}

export function isGameOver(state: GameState): boolean {
  return state.phase === 'over'
}

export function serialize(state: GameState): string {
  return JSON.stringify(state)
}

export function deserialize(json: string): GameState {
  const raw: unknown = JSON.parse(json)
  if (typeof raw !== 'object' || raw === null || (raw as { version?: unknown }).version !== 1) {
    throw new Error('unsupported saved game version')
  }
  const s = raw as GameState
  if (!Array.isArray(s.players) || s.players.length < MIN_PLAYERS) throw new Error('corrupt saved game')
  return cloneState(s)
}
