import { describe, expect, it } from 'vitest'
import {
  GOAL,
  START_OFFSET,
  TRACK_LENGTH,
  YARD,
  canMoveToken,
  createGame,
  currentPlayer,
  deserialize,
  isGameOver,
  legalMoves,
  moveToken,
  playerIndex,
  progressScore,
  roll,
  rollDie,
  rollForced,
  serialize,
  winner,
  type GameEvent,
  type GameSettings,
  type GameState,
  type PlayerColor,
} from '../src/engine'

const types = (events: GameEvent[]) => events.map((e) => e.type)

function game(colors: PlayerColor[], settings: Partial<GameSettings> = {}, seed = 1): GameState {
  return createGame({ players: colors.map((color) => ({ color })), seed, settings })
}

/** Returns a copy with the given player's tokens replaced and the turn handed to `turnOf`. */
function withTokens(state: GameState, tokens: Partial<Record<PlayerColor, number[]>>, turnOf?: PlayerColor): GameState {
  const s: GameState = {
    ...state,
    players: state.players.map((p) => ({ ...p, tokens: tokens[p.color] ? [...tokens[p.color]!] : [...p.tokens] })),
  }
  if (turnOf) s.current = playerIndex(s, turnOf)
  return s
}

/** Relative position for `color` that lands on the absolute track cell `absIdx`. */
const relPos = (color: PlayerColor, absIdx: number) => (absIdx - START_OFFSET[color] + TRACK_LENGTH) % TRACK_LENGTH

describe('createGame', () => {
  it('seats players clockwise regardless of input order and names them by colour', () => {
    const s = createGame({ players: [{ color: 'blue' }, { color: 'red', name: '  Akhil ' }, { color: 'green', isBot: true }] })
    expect(s.players.map((p) => p.color)).toEqual(['red', 'green', 'blue'])
    expect(s.players.map((p) => p.name)).toEqual(['Akhil', 'Green', 'Blue'])
    expect(s.players[1].isBot).toBe(true)
    expect(s.players.every((p) => p.tokens.every((t) => t === YARD))).toBe(true)
    expect(s.phase).toBe('roll')
    expect(s.current).toBe(0)
    expect(s.ranking).toEqual([])
  })

  it('rejects bad player counts and colours', () => {
    expect(() => game(['red'])).toThrow(RangeError)
    expect(() => createGame({ players: [1, 2, 3, 4, 5].map(() => ({ color: 'red' })) })).toThrow(RangeError)
    expect(() => game(['red', 'red'])).toThrow(/duplicate/)
    expect(() => createGame({ players: [{ color: 'red' }, { color: 'pink' as PlayerColor }] })).toThrow(/unknown/)
  })

  it('merges settings over the defaults', () => {
    const s = game(['red', 'yellow'], { blockingRule: true })
    expect(s.settings).toEqual({ blockingRule: true, endAtFirstWinner: false, autoMoveSingle: true })
  })
})

describe('rolling', () => {
  it('uses the seeded rng so games are replayable', () => {
    const s0 = game(['red', 'yellow'], {}, 777)
    const expected = rollDie(777).value
    const { state, events } = roll(s0)
    expect(events[0]).toEqual({ type: 'rolled', player: 'red', value: expected })
    expect(state.rngState).not.toBe(s0.rngState)
    expect(state.turn).toBe(1)
    expect(s0.turn).toBe(0) // input untouched
  })

  it('rejects out-of-range forced values and rolling in the wrong phase', () => {
    const s = game(['red', 'yellow'])
    expect(() => rollForced(s, 0)).toThrow(RangeError)
    expect(() => rollForced(s, 7)).toThrow(RangeError)
    expect(() => rollForced(s, 2.5)).toThrow(RangeError)
    const moving = rollForced(s, 6).state
    expect(() => roll(moving)).toThrow(/cannot roll/)
    expect(() => rollForced(moving, 3)).toThrow(/cannot roll/)
  })

  it('needs a six to leave the yard: a non-six with everything in the yard passes the turn', () => {
    const { state, events } = rollForced(game(['red', 'yellow']), 3)
    expect(types(events)).toEqual(['rolled', 'noMoves', 'turnChanged'])
    expect(currentPlayer(state).color).toBe('yellow')
    expect(state.phase).toBe('roll')
    expect(state.dice).toBeNull()
  })

  it('a six makes every yard token playable', () => {
    const { state } = rollForced(game(['red', 'yellow']), 6)
    expect(state.phase).toBe('move')
    expect(legalMoves(state)).toEqual([0, 1, 2, 3])
  })

  it('legalMoves is empty outside the move phase', () => {
    expect(legalMoves(game(['red', 'yellow']))).toEqual([])
  })
})

describe('unlocking and bonus rolls', () => {
  it('a six unlocks a token onto the start cell and grants another roll', () => {
    const rolled = rollForced(game(['red', 'yellow']), 6).state
    const { state, events } = moveToken(rolled, 2)
    expect(types(events)).toEqual(['unlocked', 'moved', 'bonusRoll'])
    expect(events[1]).toEqual({ type: 'moved', player: 'red', token: 2, from: YARD, to: 0 })
    expect(events[2]).toEqual({ type: 'bonusRoll', player: 'red', reason: 'six' })
    expect(state.players[0].tokens).toEqual([YARD, YARD, 0, YARD])
    expect(currentPlayer(state).color).toBe('red')
    expect(state.phase).toBe('roll')
    expect(state.dice).toBeNull()
  })

  it('a normal move passes the turn', () => {
    const s = withTokens(game(['red', 'yellow']), { red: [0, YARD, YARD, YARD] })
    const { state, events } = moveToken(rollForced(s, 4).state, 0)
    expect(types(events)).toEqual(['moved', 'turnChanged'])
    expect(state.players[0].tokens[0]).toBe(4)
    expect(currentPlayer(state).color).toBe('yellow')
  })

  it('a six with no legal move still grants another roll', () => {
    const s = withTokens(game(['red', 'yellow']), { red: [55, 55, GOAL, GOAL] })
    const { state, events } = rollForced(s, 6)
    expect(types(events)).toEqual(['rolled', 'noMoves', 'bonusRoll'])
    expect(currentPlayer(state).color).toBe('red')
    expect(state.phase).toBe('roll')
  })
})

describe('three sixes', () => {
  it('forfeits the turn on the third consecutive six', () => {
    let s = game(['red', 'yellow'])
    s = moveToken(rollForced(s, 6).state, 0).state
    expect(s.sixStreak).toBe(1)
    s = moveToken(rollForced(s, 6).state, 1).state
    expect(s.sixStreak).toBe(2)
    const { state, events } = rollForced(s, 6)
    expect(types(events)).toEqual(['rolled', 'threeSixes', 'turnChanged'])
    expect(state.phase).toBe('roll')
    expect(state.dice).toBeNull()
    expect(state.sixStreak).toBe(0)
    expect(currentPlayer(state).color).toBe('yellow')
    // The third six moved nothing.
    expect(state.players[0].tokens).toEqual([0, 0, YARD, YARD])
  })

  it('a non-six resets the streak', () => {
    let s = game(['red', 'yellow'])
    s = moveToken(rollForced(s, 6).state, 0).state
    s = moveToken(rollForced(s, 6).state, 1).state
    s = moveToken(rollForced(s, 2).state, 0).state // turn passes to yellow
    expect(currentPlayer(s).color).toBe('yellow')
    expect(s.sixStreak).toBe(0)
    s = rollForced(s, 3).state // yellow: nothing to move, back to red
    expect(currentPlayer(s).color).toBe('red')
    s = moveToken(rollForced(s, 6).state, 2).state
    const second = rollForced(s, 6)
    expect(types(second.events)).not.toContain('threeSixes')
  })

  it('sixes with no legal move still count toward the forfeit', () => {
    let s = withTokens(game(['red', 'yellow']), { red: [55, 55, GOAL, GOAL] })
    s = rollForced(s, 6).state
    s = rollForced(s, 6).state
    const { state, events } = rollForced(s, 6)
    expect(types(events)).toContain('threeSixes')
    expect(currentPlayer(state).color).toBe('yellow')
  })
})

describe('home lane and goal', () => {
  it('requires an exact roll to reach the goal', () => {
    const s = withTokens(game(['red', 'yellow']), { red: [54, YARD, YARD, YARD] })
    expect(canMoveToken(s, 0, 0, 2)).toBe(true)
    expect(canMoveToken(s, 0, 0, 3)).toBe(false)
    const overshoot = rollForced(s, 3)
    expect(types(overshoot.events)).toEqual(['rolled', 'noMoves', 'turnChanged'])
  })

  it('reaching the goal grants a bonus roll', () => {
    const s = withTokens(game(['red', 'yellow']), { red: [54, 0, YARD, YARD] })
    const { state, events } = moveToken(rollForced(s, 2).state, 0)
    expect(types(events)).toEqual(['moved', 'reachedGoal', 'bonusRoll'])
    expect(events[2]).toEqual({ type: 'bonusRoll', player: 'red', reason: 'goal' })
    expect(state.players[0].tokens[0]).toBe(GOAL)
    expect(currentPlayer(state).color).toBe('red')
  })

  it('a finished token can never move again', () => {
    const s = withTokens(game(['red', 'yellow']), { red: [GOAL, 0, YARD, YARD] })
    expect(canMoveToken(s, 0, 0, 1)).toBe(false)
    expect(legalMoves(rollForced(s, 1).state)).toEqual([1])
  })
})

describe('capturing', () => {
  it('landing on an opponent on a plain cell sends it home and grants a bonus roll', () => {
    const base = game(['red', 'green'])
    const s = withTokens(base, { red: [1, YARD, YARD, YARD], green: [relPos('green', 5), YARD, YARD, YARD] })
    const { state, events } = moveToken(rollForced(s, 4).state, 0)
    expect(types(events)).toEqual(['moved', 'captured', 'bonusRoll'])
    expect(events[1]).toMatchObject({ type: 'captured', attacker: 'red', victim: 'green', token: 0 })
    expect(events[2]).toEqual({ type: 'bonusRoll', player: 'red', reason: 'capture' })
    expect(state.players[1].tokens[0]).toBe(YARD)
    expect(state.players[0].tokens[0]).toBe(5)
    expect(currentPlayer(state).color).toBe('red')
    expect(state.phase).toBe('roll')
  })

  it('captures every opponent token on that cell', () => {
    const g = relPos('green', 5)
    const s = withTokens(game(['red', 'green', 'yellow']), {
      red: [1, YARD, YARD, YARD],
      green: [g, g, YARD, YARD],
      yellow: [relPos('yellow', 5), YARD, YARD, YARD],
    })
    const { state, events } = moveToken(rollForced(s, 4).state, 0)
    expect(events.filter((e) => e.type === 'captured')).toHaveLength(3)
    expect(state.players[1].tokens).toEqual([YARD, YARD, YARD, YARD])
    expect(state.players[2].tokens[0]).toBe(YARD)
  })

  it('capture takes priority over the six as the bonus reason', () => {
    const s = withTokens(game(['red', 'green']), { red: [0, YARD, YARD, YARD], green: [relPos('green', 6), YARD, YARD, YARD] })
    const { events } = moveToken(rollForced(s, 6).state, 0)
    expect(events.at(-1)).toEqual({ type: 'bonusRoll', player: 'red', reason: 'capture' })
  })

  it('never captures on a star cell', () => {
    const s = withTokens(game(['red', 'green']), { red: [4, YARD, YARD, YARD], green: [relPos('green', 8), YARD, YARD, YARD] })
    const { state, events } = moveToken(rollForced(s, 4).state, 0)
    expect(types(events)).toEqual(['moved', 'turnChanged'])
    expect(state.players[1].tokens[0]).toBe(relPos('green', 8))
  })

  it('never captures on a start cell, even when unlocking onto an opponent', () => {
    const s = withTokens(game(['red', 'green']), { green: [relPos('green', 0), YARD, YARD, YARD] })
    const { state, events } = moveToken(rollForced(s, 6).state, 0)
    expect(types(events)).toEqual(['unlocked', 'moved', 'bonusRoll'])
    expect(state.players[1].tokens[0]).toBe(relPos('green', 0))
    expect(state.players[0].tokens[0]).toBe(0)
  })

  it('does not capture your own tokens', () => {
    const s = withTokens(game(['red', 'green']), { red: [5, 1, YARD, YARD] })
    const { state, events } = moveToken(rollForced(s, 4).state, 1)
    expect(types(events)).toEqual(['moved', 'turnChanged'])
    expect(state.players[0].tokens).toEqual([5, 5, YARD, YARD])
  })

  it('nothing to capture in the private lane', () => {
    const s = withTokens(game(['red', 'green']), { red: [50, YARD, YARD, YARD], green: [10, YARD, YARD, YARD] })
    const { events } = moveToken(rollForced(s, 2).state, 0)
    expect(types(events)).toEqual(['moved', 'turnChanged'])
  })
})

describe('blocking rule', () => {
  const g = relPos('green', 5)
  const setup = (blockingRule: boolean) =>
    withTokens(game(['red', 'green'], { blockingRule }), { red: [1, YARD, YARD, YARD], green: [g, g, YARD, YARD] })

  it('is off by default: landing on two opponents captures both', () => {
    const { state } = moveToken(rollForced(setup(false), 4).state, 0)
    expect(state.players[1].tokens).toEqual([YARD, YARD, YARD, YARD])
  })

  it('when on, a block cannot be landed on or passed, but stopping short is fine', () => {
    const s = setup(true)
    expect(canMoveToken(s, 0, 0, 4)).toBe(false) // land on it
    expect(canMoveToken(s, 0, 0, 5)).toBe(false) // pass through it
    expect(canMoveToken(s, 0, 0, 3)).toBe(true) // stop before it
  })

  it('two opponent tokens on a safe cell are not a block', () => {
    const star = relPos('green', 8)
    const s = withTokens(game(['red', 'green'], { blockingRule: true }), { red: [4, YARD, YARD, YARD], green: [star, star, YARD, YARD] })
    expect(canMoveToken(s, 0, 0, 4)).toBe(true)
    expect(canMoveToken(s, 0, 0, 5)).toBe(true)
  })

  it('one token of each of two opponents is not a block', () => {
    const s = withTokens(game(['red', 'green', 'yellow'], { blockingRule: true }), {
      red: [1, YARD, YARD, YARD],
      green: [relPos('green', 5), YARD, YARD, YARD],
      yellow: [relPos('yellow', 5), YARD, YARD, YARD],
    })
    expect(canMoveToken(s, 0, 0, 4)).toBe(true)
  })
})

describe('finishing and game over', () => {
  it('two players: the first to finish ends the game with a full ranking', () => {
    const s = withTokens(game(['red', 'yellow']), { red: [GOAL, GOAL, GOAL, 54], yellow: [3, YARD, YARD, YARD] })
    const { state, events } = moveToken(rollForced(s, 2).state, 3)
    expect(types(events)).toEqual(['moved', 'reachedGoal', 'finished', 'finished', 'gameOver'])
    expect(state.phase).toBe('over')
    expect(state.ranking).toEqual(['red', 'yellow'])
    expect(state.players.map((p) => p.rank)).toEqual([1, 2])
    expect(winner(state)).toBe('red')
    expect(isGameOver(state)).toBe(true)
    expect(() => roll(state)).toThrow(/cannot roll/)
    expect(() => moveToken(state, 0)).toThrow(/cannot move/)
  })

  it('three players: the game continues after the first finisher and skips them in turn order', () => {
    const s = withTokens(game(['red', 'green', 'yellow']), { green: [GOAL, GOAL, GOAL, 55] }, 'green')
    const { state, events } = moveToken(rollForced(s, 1).state, 3)
    expect(types(events)).toEqual(['moved', 'reachedGoal', 'finished', 'turnChanged'])
    expect(state.phase).toBe('roll')
    expect(state.ranking).toEqual(['green'])
    expect(currentPlayer(state).color).toBe('yellow')
    // yellow passes with a 2, turn goes to red, skipping green.
    const next = rollForced(state, 2).state
    expect(currentPlayer(next).color).toBe('red')
    const afterRed = rollForced(next, 2).state
    expect(currentPlayer(afterRed).color).toBe('yellow')
  })

  it('a finished player does not get a bonus roll for the six that finished them', () => {
    const s = withTokens(game(['red', 'green', 'yellow']), { red: [GOAL, GOAL, GOAL, 50] })
    const { state, events } = moveToken(rollForced(s, 6).state, 3)
    expect(types(events)).toEqual(['moved', 'reachedGoal', 'finished', 'turnChanged'])
    expect(currentPlayer(state).color).toBe('green')
  })

  it('endAtFirstWinner ranks the rest by progress', () => {
    const s = withTokens(game(['red', 'green', 'yellow', 'blue'], { endAtFirstWinner: true }), {
      red: [GOAL, GOAL, GOAL, 55],
      green: [10, YARD, YARD, YARD],
      yellow: [GOAL, 2, YARD, YARD],
      blue: [12, YARD, YARD, YARD],
    })
    const { state } = moveToken(rollForced(s, 1).state, 3)
    expect(state.phase).toBe('over')
    expect(state.ranking).toEqual(['red', 'yellow', 'blue', 'green'])
    expect(state.players.map((p) => p.rank)).toEqual([1, 4, 2, 3])
  })

  it('progress ties are broken by seat order', () => {
    const s = withTokens(game(['red', 'green', 'yellow'], { endAtFirstWinner: true }), {
      red: [GOAL, GOAL, GOAL, 55],
      green: [5, YARD, YARD, YARD],
      yellow: [5, YARD, YARD, YARD],
    })
    const { state } = moveToken(rollForced(s, 1).state, 3)
    expect(state.ranking).toEqual(['red', 'green', 'yellow'])
  })

  it('progressScore counts goals heavily and yard tokens as zero', () => {
    expect(progressScore({ color: 'red', name: '', isBot: false, rank: null, tokens: [YARD, YARD, YARD, YARD] })).toBe(0)
    expect(progressScore({ color: 'red', name: '', isBot: false, rank: null, tokens: [GOAL, 0, 9, YARD] })).toBe(111)
  })
})

describe('moveToken guards and immutability', () => {
  it('rejects illegal moves and moves in the wrong phase', () => {
    const s = game(['red', 'yellow'])
    expect(() => moveToken(s, 0)).toThrow(/cannot move/)
    const rolled = rollForced(withTokens(s, { red: [GOAL, 0, YARD, YARD] }), 3).state
    expect(() => moveToken(rolled, 0)).toThrow(/no legal move/)
    expect(() => moveToken(rolled, 2)).toThrow(/no legal move/)
  })

  it('never mutates the input state', () => {
    const s = withTokens(game(['red', 'green']), { red: [1, YARD, YARD, YARD], green: [relPos('green', 5), YARD, YARD, YARD] })
    const snapshot = JSON.stringify(s)
    const rolled = rollForced(s, 4)
    moveToken(rolled.state, 0)
    expect(JSON.stringify(s)).toBe(snapshot)
    expect(JSON.stringify(rolled.state)).toBe(JSON.stringify(rolled.state))
    expect(rolled.state.players[1].tokens[0]).toBe(relPos('green', 5))
  })
})

describe('serialization', () => {
  it('round-trips a mid-game state', () => {
    let s = game(['red', 'green', 'yellow', 'blue'], {}, 2024)
    for (let i = 0; i < 30; i++) {
      s = roll(s).state
      const moves = legalMoves(s)
      if (moves.length) s = moveToken(s, moves[0]).state
    }
    const copy = deserialize(serialize(s))
    expect(copy).toEqual(s)
    expect(copy).not.toBe(s)
    expect(copy.players[0].tokens).not.toBe(s.players[0].tokens)
  })

  it('rejects other versions and corrupt payloads', () => {
    expect(() => deserialize('{"version":2}')).toThrow(/version/)
    expect(() => deserialize('null')).toThrow(/version/)
    expect(() => deserialize('{"version":1,"players":[]}')).toThrow(/corrupt/)
  })
})

describe('simulated full games', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])('seed %i plays to completion while holding invariants', (seed) => {
    let s = game(['red', 'green', 'yellow', 'blue'], {}, seed)
    let steps = 0
    while (!isGameOver(s) && steps < 20000) {
      steps++
      if (s.phase === 'roll') {
        s = roll(s).state
      } else {
        const moves = legalMoves(s)
        expect(moves.length).toBeGreaterThan(0)
        s = moveToken(s, moves[steps % moves.length]).state
      }
      for (const p of s.players) {
        for (const t of p.tokens) {
          expect(t).toBeGreaterThanOrEqual(YARD)
          expect(t).toBeLessThanOrEqual(GOAL)
        }
      }
      expect(currentPlayer(s).rank === null || isGameOver(s)).toBe(true)
    }
    expect(isGameOver(s)).toBe(true)
    expect(steps).toBeLessThan(20000)
    expect([...s.ranking].sort()).toEqual(['blue', 'green', 'red', 'yellow'])
    expect(s.players.map((p) => p.rank).sort()).toEqual([1, 2, 3, 4])
  })
})
