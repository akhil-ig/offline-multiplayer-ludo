/**
 * Heuristic computer player. Pure: given a state in the `move` phase it picks
 * a token index. Priorities (highest first): finish a token, capture, leave the
 * yard, escape a threatened cell, land on a safe cell, avoid landing in danger,
 * otherwise advance the most progressed token.
 */
import { isOnTrack, isSafeTrackIndex, trackIndex, isInLane, TRACK_LENGTH } from './boardCoords'
import { currentPlayer, legalMoves, opponentsAt } from './rules'
import { GOAL, TRACK_END, YARD, type GameState, type Player } from './types'

const W = {
  goal: 100,
  capture: 80,
  unlock: 60,
  escape: 30,
  safe: 15,
  lane: 12,
  danger: -35,
  progress: 0.2,
} as const

/** True when any opponent token could land on `absIdx` with its next roll. */
export function isThreatened(state: GameState, playerIdx: number, absIdx: number): boolean {
  if (isSafeTrackIndex(absIdx)) return false
  for (let pi = 0; pi < state.players.length; pi++) {
    if (pi === playerIdx) continue
    const opp = state.players[pi]
    for (const pos of opp.tokens) {
      if (!isOnTrack(pos)) continue
      for (let k = 1; k <= 6; k++) {
        if (pos + k > TRACK_END) break
        if ((trackIndex(opp.color, pos) + k) % TRACK_LENGTH === absIdx) return true
      }
    }
  }
  return false
}

export function scoreMove(state: GameState, me: Player, playerIdx: number, tokenIdx: number, dice: number): number {
  const from = me.tokens[tokenIdx]
  const to = from === YARD ? 0 : from + dice
  let score = 0
  if (to === GOAL) score += W.goal
  if (from === YARD) score += W.unlock
  if (isInLane(to)) score += W.lane
  if (isOnTrack(to)) {
    const abs = trackIndex(me.color, to)
    const safe = isSafeTrackIndex(abs)
    if (!safe) score += opponentsAt(state, playerIdx, abs).length * W.capture
    if (safe) score += W.safe
    else if (isThreatened(state, playerIdx, abs)) score += W.danger
  }
  if (isOnTrack(from) && isThreatened(state, playerIdx, trackIndex(me.color, from))) score += W.escape
  score += Math.max(from, 0) * W.progress
  return score
}

/** Picks the best legal token for the current player, or null when nothing can move. */
export function chooseMove(state: GameState): number | null {
  const moves = legalMoves(state)
  if (moves.length === 0 || state.dice === null) return null
  const me = currentPlayer(state)
  let best = moves[0]
  let bestScore = -Infinity
  for (const t of moves) {
    const s = scoreMove(state, me, state.current, t, state.dice)
    if (s > bestScore) {
      best = t
      bestScore = s
    }
  }
  return best
}
