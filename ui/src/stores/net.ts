import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { GameEvent, GameState, PlayerColor } from '@/engine'
import { LanClient, type ConnState } from '@/net/client'
import { wsUrl, type ClientMsg, type IntentAction, type LobbyPlayer, type SeatMap, type ServerMsg } from '@/net/protocol'

export type NetMode = 'off' | 'host' | 'join'

const SEAT_KEY = 'ludo.lan.seat.v1'

interface SavedSeat {
  code: string
  seatToken: string
  playerId: string
  isHost: boolean
  name: string
}

export interface RemoteStateMsg {
  state: GameState
  events: GameEvent[]
  seats: SeatMap
}

/**
 * LAN session state. The host's game store is authoritative; joiners receive
 * state broadcasts and send intents. This store only moves messages; the game
 * flow decides what they mean.
 */
export const useNetStore = defineStore('net', () => {
  const mode = ref<NetMode>('off')
  const conn = ref<ConnState>('idle')
  const code = ref('')
  const joinUrl = ref('')
  const playerId = ref('')
  const seatToken = ref('')
  const myName = ref('')
  const players = ref<LobbyPlayer[]>([])
  const seats = ref<SeatMap>({})
  const error = ref('')
  let client: LanClient | null = null

  // Listeners installed by the game flow.
  let onIntent: ((from: string, action: IntentAction, token?: number) => void) | null = null
  let onRemoteState: ((msg: RemoteStateMsg) => void) | null = null
  let onHint: ((color: PlayerColor) => void) | null = null

  const isHost = computed(() => mode.value === 'host')
  const isJoiner = computed(() => mode.value === 'join')
  const active = computed(() => mode.value !== 'off')
  const myColor = computed<PlayerColor | null>(() => seats.value[playerId.value] ?? null)
  const connected = computed(() => conn.value === 'open')
  const me = computed(() => players.value.find((p) => p.id === playerId.value) ?? null)

  function colorOf(id: string): PlayerColor | null {
    return seats.value[id] ?? null
  }

  function playerIdOf(color: PlayerColor): string | null {
    for (const [id, c] of Object.entries(seats.value)) if (c === color) return id
    return null
  }

  function saveSeat() {
    try {
      const s: SavedSeat = { code: code.value, seatToken: seatToken.value, playerId: playerId.value, isHost: isHost.value, name: myName.value }
      localStorage.setItem(SEAT_KEY, JSON.stringify(s))
    } catch {
      /* ignore */
    }
  }

  function loadSeat(): SavedSeat | null {
    try {
      const raw = localStorage.getItem(SEAT_KEY)
      return raw ? (JSON.parse(raw) as SavedSeat) : null
    } catch {
      return null
    }
  }

  function clearSeat() {
    try {
      localStorage.removeItem(SEAT_KEY)
    } catch {
      /* ignore */
    }
  }

  function handle(msg: ServerMsg) {
    switch (msg.type) {
      case 'welcome':
        code.value = msg.code
        playerId.value = msg.playerId
        seatToken.value = msg.seatToken
        joinUrl.value = msg.joinUrl
        mode.value = msg.isHost ? 'host' : 'join'
        error.value = ''
        client?.setHello({ type: 'reconnect', code: msg.code, seatToken: msg.seatToken })
        saveSeat()
        break
      case 'lobby':
        players.value = msg.players
        break
      case 'intent':
        onIntent?.(msg.from, msg.action, msg.token)
        break
      case 'state':
        seats.value = msg.seats
        onRemoteState?.({ state: msg.state, events: msg.events, seats: msg.seats })
        break
      case 'hint':
        onHint?.(msg.color)
        break
      case 'error':
        error.value = msg.message
        break
      default:
        break
    }
  }

  function open(hello: ClientMsg, name: string) {
    client?.close()
    myName.value = name
    error.value = ''
    client = new LanClient(wsUrl(), {
      onMessage: handle,
      onState: (s) => (conn.value = s),
    })
    client.connect(hello)
  }

  function host(name: string) {
    mode.value = 'host'
    open({ type: 'create', name }, name)
  }

  function join(roomCode: string, name: string) {
    mode.value = 'join'
    open({ type: 'join', code: roomCode.toUpperCase(), name }, name)
  }

  /** Reattach to a previous seat (page reload / app resume). Returns false if nothing was saved. */
  function reconnect(): boolean {
    const saved = loadSeat()
    if (!saved) return false
    mode.value = saved.isHost ? 'host' : 'join'
    code.value = saved.code
    playerId.value = saved.playerId
    seatToken.value = saved.seatToken
    open({ type: 'reconnect', code: saved.code, seatToken: saved.seatToken }, saved.name)
    return true
  }

  function savedSeat(): SavedSeat | null {
    return loadSeat()
  }

  function leave() {
    client?.close()
    client = null
    mode.value = 'off'
    conn.value = 'idle'
    code.value = ''
    joinUrl.value = ''
    playerId.value = ''
    seatToken.value = ''
    players.value = []
    seats.value = {}
    error.value = ''
    clearSeat()
  }

  function sendIntent(action: IntentAction, token?: number): boolean {
    const msg: ClientMsg = token === undefined ? { type: 'intent', action } : { type: 'intent', action, token }
    return client?.send(msg) ?? false
  }

  function broadcastState(state: GameState, events: GameEvent[]): boolean {
    return client?.send({ type: 'state', state, events, seats: seats.value }) ?? false
  }

  function sendHint(color: PlayerColor): boolean {
    return client?.send({ type: 'hint', kind: 'rolling', color }) ?? false
  }

  function setSeats(map: SeatMap) {
    seats.value = map
  }

  function bind(handlers: {
    onIntent?: typeof onIntent
    onRemoteState?: typeof onRemoteState
    onHint?: typeof onHint
  }) {
    onIntent = handlers.onIntent ?? null
    onRemoteState = handlers.onRemoteState ?? null
    onHint = handlers.onHint ?? null
  }

  return {
    mode,
    conn,
    code,
    joinUrl,
    playerId,
    seatToken,
    myName,
    players,
    seats,
    error,
    isHost,
    isJoiner,
    active,
    myColor,
    connected,
    me,
    colorOf,
    playerIdOf,
    host,
    join,
    reconnect,
    savedSeat,
    leave,
    sendIntent,
    broadcastState,
    sendHint,
    setSeats,
    bind,
  }
})
