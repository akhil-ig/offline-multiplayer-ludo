import { describe, expect, it } from 'vitest'
import {
  GOAL,
  START_OFFSET,
  TRACK_LENGTH,
  YARD,
  chooseMove,
  createGame,
  isGameOver,
  isThreatened,
  moveToken,
  playerIndex,
  roll,
  rollForced,
  trackIndex,
  type GameState,
  type PlayerColor,
} from '../src/engine'

function game(colors: PlayerColor[], seed = 1): GameState {
  return createGame({ players: colors.map((color) => ({ color, isBot: true })), seed })
}

function withTokens(state: GameState, tokens: Partial<Record<PlayerColor, number[]>>, turnOf?: PlayerColor): GameState {
  const s: GameState = {
    ...state,
    players: state.players.map((p) => ({ ...p, tokens: tokens[p.color] ? [...tokens[p.color]!] : [...p.tokens] })),
  }
  if (turnOf) s.current = playerIndex(s, turnOf)
  return s
}

const relPos = (color: PlayerColor, absIdx: number) => (absIdx - START_OFFSET[color] + TRACK_LENGTH) % TRACK_LENGTH

describe('bot priorities', () => {
  it('returns null outside the move phase', () => {
    expect(chooseMove(game(['red', 'yellow']))).toBeNull()
  })

  it('prefers finishing a token over anything else', () => {
    const s = withTokens(game(['red', 'green']), { red: [54, 10, YARD, YARD], green: [relPos('green', 12), YARD, YARD, YARD] })
    // dice 2: token 0 reaches goal; token 1 would capture green at abs 12
    expect(chooseMove(rollForced(s, 2).state)).toBe(0)
  })

  it('prefers a capture over a plain move', () => {
    const s = withTokens(game(['red', 'green']), { red: [20, 1, YARD, YARD], green: [relPos('green', 5), YARD, YARD, YARD] })
    expect(chooseMove(rollForced(s, 4).state)).toBe(1)
  })

  it('prefers unlocking on a six over a plain move', () => {
    const s = withTokens(game(['red', 'green']), { red: [20, YARD, YARD, YARD] })
    expect(chooseMove(rollForced(s, 6).state)).toBe(1)
  })

  it('prefers a capture over unlocking', () => {
    // abs 27 is a plain cell (26 would be yellow's safe start square)
    const s = withTokens(game(['red', 'green']), { red: [21, YARD, YARD, YARD], green: [relPos('green', 27), YARD, YARD, YARD] })
    expect(chooseMove(rollForced(s, 6).state)).toBe(0)
  })

  it('escapes a threatened cell rather than moving a safe token', () => {
    // red token 0 at rel 10 (abs 10) with green one step behind at abs 9 -> threatened.
    // red token 1 at rel 8 (star, safe).
    const s = withTokens(game(['red', 'green']), { red: [10, 8, YARD, YARD], green: [relPos('green', 9), YARD, YARD, YARD] })
    const st = rollForced(s, 2).state
    expect(isThreatened(st, 0, trackIndex('red', 10))).toBe(true)
    expect(chooseMove(st)).toBe(0)
  })

  it('avoids landing right in front of an opponent when a safer move exists', () => {
    // dice 3: token 0 (rel 2 -> 5) would land one ahead of green at abs 4; token 1 (rel 30 -> 33) is quiet.
    const s = withTokens(game(['red', 'green']), { red: [2, 30, YARD, YARD], green: [relPos('green', 4), YARD, YARD, YARD] })
    expect(chooseMove(rollForced(s, 3).state)).toBe(1)
  })

  it('threat detection respects safe cells and lane turn-offs', () => {
    const s = withTokens(game(['red', 'green']), { green: [relPos('green', 7), YARD, YARD, YARD] })
    expect(isThreatened(s, 0, 8)).toBe(false) // star cell is never threatened
    expect(isThreatened(s, 0, 9)).toBe(true)
    // an opponent on its last track cell (rel 50) turns into its lane and cannot reach the next abs cell
    const t = withTokens(game(['red', 'green']), { green: [50, YARD, YARD, YARD] })
    expect(isThreatened(t, 0, (trackIndex('green', 50) + 1) % TRACK_LENGTH)).toBe(false)
  })

  it('with nothing special, advances the most progressed token', () => {
    const s = withTokens(game(['red', 'green']), { red: [30, 10, YARD, YARD] })
    expect(chooseMove(rollForced(s, 2).state)).toBe(0)
  })
})

describe('bot soak', () => {
  it.each([11, 22, 33, 44, 55, 66, 77, 88, 99, 110])('four bots finish a game with seed %i', (seed) => {
    let s = game(['red', 'green', 'yellow', 'blue'], seed)
    let steps = 0
    while (!isGameOver(s) && steps < 30000) {
      steps++
      if (s.phase === 'roll') s = roll(s).state
      else {
        const t = chooseMove(s)
        expect(t).not.toBeNull()
        s = moveToken(s, t as number).state
      }
    }
    expect(isGameOver(s)).toBe(true)
    expect(s.players.every((p) => p.rank !== null)).toBe(true)
    expect(s.players.filter((p) => p.tokens.every((x) => x === GOAL)).length).toBeGreaterThanOrEqual(3)
  })
})
