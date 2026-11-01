/**
 * Wire protocol between browsers and the Rust relay server.
 * Mirrors server/src/protocol.rs. All messages are JSON with a `type` tag.
 */
import type { GameEvent, GameState, PlayerColor } from '@/engine'

export interface LobbyPlayer {
  id: string
  name: string
  connected: boolean
  isHost: boolean
}

export type IntentAction = 'roll' | 'move'

export type SeatMap = Record<string, PlayerColor>

export type ClientMsg =
  | { type: 'create'; name: string }
  | { type: 'join'; code: string; name: string }
  | { type: 'reconnect'; code: string; seatToken: string }
  | { type: 'intent'; action: IntentAction; token?: number }
  | { type: 'state'; state: GameState; events: GameEvent[]; seats: SeatMap }
  | { type: 'hint'; kind: 'rolling'; color: PlayerColor }
  | { type: 'ping' }

export type ServerMsg =
  | { type: 'welcome'; code: string; playerId: string; seatToken: string; isHost: boolean; joinUrl: string }
  | { type: 'lobby'; players: LobbyPlayer[] }
  | { type: 'intent'; from: string; action: IntentAction; token?: number }
  | { type: 'state'; state: GameState; events: GameEvent[]; seats: SeatMap }
  | { type: 'hint'; kind: 'rolling'; color: PlayerColor }
  | { type: 'error'; message: string }
  | { type: 'pong' }

/** Where the relay lives. Same origin when served by the Rust binary; overridable for `vite dev`. */
export function wsUrl(): string {
  const override = new URLSearchParams(location.search).get('ws')
  if (override) return override
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}/ws`
}
