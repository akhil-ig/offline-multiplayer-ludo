import type { ClientMsg, ServerMsg } from './protocol'

export type ConnState = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed'

export interface ClientHandlers {
  onMessage: (msg: ServerMsg) => void
  onState: (state: ConnState) => void
}

const PING_MS = 15000
const BACKOFF_MS = [800, 1500, 3000, 5000, 8000]

/**
 * Thin WebSocket wrapper with heartbeat and automatic reconnection.
 * After a drop it reopens the socket and replays the `hello` message
 * (a `reconnect` with the seat token) so the server can restore the seat.
 */
export class LanClient {
  private ws: WebSocket | null = null
  private attempts = 0
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private closedByUser = false
  private hello: ClientMsg | null = null
  state: ConnState = 'idle'
  private readonly url: string
  private readonly handlers: ClientHandlers

  constructor(url: string, handlers: ClientHandlers) {
    this.url = url
    this.handlers = handlers
  }

  /** Opens the socket and sends `hello` once it is up. Subsequent reconnects resend `hello`. */
  connect(hello: ClientMsg): void {
    this.hello = hello
    this.closedByUser = false
    this.open()
  }

  /** Replace the hello used on reconnect (e.g. switch from `create` to `reconnect` once a seat token exists). */
  setHello(hello: ClientMsg): void {
    this.hello = hello
  }

  send(msg: ClientMsg): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
      return true
    }
    return false
  }

  close(): void {
    this.closedByUser = true
    this.clearTimers()
    this.ws?.close()
    this.ws = null
    this.setState('closed')
  }

  private setState(s: ConnState) {
    this.state = s
    this.handlers.onState(s)
  }

  private clearTimers() {
    if (this.pingTimer) clearInterval(this.pingTimer)
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.pingTimer = null
    this.retryTimer = null
  }

  private open() {
    this.clearTimers()
    this.setState(this.attempts === 0 ? 'connecting' : 'reconnecting')
    let ws: WebSocket
    try {
      ws = new WebSocket(this.url)
    } catch {
      this.scheduleRetry()
      return
    }
    this.ws = ws
    ws.onopen = () => {
      this.attempts = 0
      this.setState('open')
      if (this.hello) this.send(this.hello)
      this.pingTimer = setInterval(() => this.send({ type: 'ping' }), PING_MS)
    }
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as ServerMsg
        if (msg.type !== 'pong') this.handlers.onMessage(msg)
      } catch {
        /* ignore malformed frames */
      }
    }
    ws.onclose = () => {
      if (this.ws !== ws) return
      this.ws = null
      this.clearTimers()
      if (!this.closedByUser) this.scheduleRetry()
    }
    ws.onerror = () => {
      /* onclose follows */
    }
  }

  private scheduleRetry() {
    const delay = BACKOFF_MS[Math.min(this.attempts, BACKOFF_MS.length - 1)]
    this.attempts++
    this.setState('reconnecting')
    this.retryTimer = setTimeout(() => this.open(), delay)
  }
}
