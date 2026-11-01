/**
 * Zero-asset Web Audio synthesiser. Every effect is generated from oscillators
 * and filtered noise, so the game is fully offline and the bundle carries no
 * audio files. The AudioContext is created lazily on the first user gesture
 * (mobile browsers refuse to start audio before one).
 */

const SCALE = [523.25, 587.33, 659.25, 698.46, 783.99, 880.0, 987.77, 1046.5] // C5 major

export class SoundEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null
  private _enabled = true
  /** Number of effects triggered; handy for tests and debugging. */
  played = 0

  get enabled(): boolean {
    return this._enabled
  }

  set enabled(v: boolean) {
    this._enabled = v
    if (this.master) this.master.gain.value = v ? 0.9 : 0
  }

  get state(): AudioContextState | 'none' {
    return this.ctx?.state ?? 'none'
  }

  /** Call from a user gesture (pointerdown/click). Safe to call repeatedly. */
  unlock(): void {
    const ctx = this.ensure()
    if (ctx && ctx.state === 'suspended') void ctx.resume()
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx
    const Ctor = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as
      | typeof AudioContext
      | undefined
    if (!Ctor) return null
    try {
      this.ctx = new Ctor()
    } catch {
      return null
    }
    this.master = this.ctx.createGain()
    this.master.gain.value = this._enabled ? 0.9 : 0
    this.master.connect(this.ctx.destination)
    return this.ctx
  }

  private ready(): { ctx: AudioContext; out: GainNode } | null {
    if (!this._enabled) return null
    const ctx = this.ensure()
    if (!ctx || !this.master || ctx.state !== 'running') return null
    this.played++
    return { ctx, out: this.master }
  }

  private noise(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    this.noiseBuffer = buf
    return buf
  }

  /** One decaying oscillator note. */
  private tone(
    ctx: AudioContext,
    out: AudioNode,
    opts: { type: OscillatorType; freq: number; to?: number; at?: number; dur: number; gain?: number; attack?: number },
  ) {
    const t0 = ctx.currentTime + (opts.at ?? 0)
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = opts.type
    osc.frequency.setValueAtTime(opts.freq, t0)
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t0 + opts.dur)
    const peak = opts.gain ?? 0.3
    const attack = opts.attack ?? 0.004
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur)
    osc.connect(g).connect(out)
    osc.start(t0)
    osc.stop(t0 + opts.dur + 0.02)
  }

  /** Short filtered noise burst. */
  private hiss(ctx: AudioContext, out: AudioNode, opts: { at?: number; dur: number; freq: number; q?: number; gain?: number }) {
    const t0 = ctx.currentTime + (opts.at ?? 0)
    const src = ctx.createBufferSource()
    src.buffer = this.noise(ctx)
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = opts.freq
    f.Q.value = opts.q ?? 1.2
    const g = ctx.createGain()
    g.gain.setValueAtTime(opts.gain ?? 0.25, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur)
    src.connect(f).connect(g).connect(out)
    src.start(t0)
    src.stop(t0 + opts.dur + 0.02)
  }

  /** Rapid clatter of woody clicks while the dice tumbles (~450ms). */
  diceRoll(): void {
    const r = this.ready()
    if (!r) return
    const clicks = 7
    for (let i = 0; i < clicks; i++) {
      const at = i * 0.058 + Math.random() * 0.02
      this.tone(r.ctx, r.out, { type: 'triangle', freq: 700 + Math.random() * 500, to: 300, at, dur: 0.05, gain: 0.22 })
      this.hiss(r.ctx, r.out, { at, dur: 0.045, freq: 2400, q: 0.8, gain: 0.12 })
    }
    // Landing thunk.
    this.tone(r.ctx, r.out, { type: 'sine', freq: 180, to: 70, at: 0.44, dur: 0.12, gain: 0.35 })
  }

  /** Pitch-ascending woodblock pop, one per cell hopped. */
  tokenHop(step: number): void {
    const r = this.ready()
    if (!r) return
    const f = SCALE[Math.min(step, SCALE.length - 1)]
    this.tone(r.ctx, r.out, { type: 'sine', freq: f, to: f * 0.9, dur: 0.11, gain: 0.3 })
    this.tone(r.ctx, r.out, { type: 'triangle', freq: f * 2, to: f * 1.9, dur: 0.06, gain: 0.08 })
  }

  /** Settling thump when a hop sequence ends. */
  tokenLand(): void {
    const r = this.ready()
    if (!r) return
    this.tone(r.ctx, r.out, { type: 'sine', freq: 220, to: 110, dur: 0.09, gain: 0.18 })
  }

  /** Bright dual-tone power-up chime when a token leaves the yard. */
  tokenUnlock(): void {
    const r = this.ready()
    if (!r) return
    this.tone(r.ctx, r.out, { type: 'sine', freq: 659, dur: 0.22, gain: 0.25 })
    this.tone(r.ctx, r.out, { type: 'sine', freq: 988, at: 0.09, dur: 0.3, gain: 0.25 })
    this.tone(r.ctx, r.out, { type: 'triangle', freq: 1319, at: 0.09, dur: 0.3, gain: 0.07 })
  }

  /** Descending laser + low thud when a token gets captured. */
  capture(): void {
    const r = this.ready()
    if (!r) return
    this.tone(r.ctx, r.out, { type: 'sawtooth', freq: 1400, to: 160, dur: 0.28, gain: 0.16 })
    this.tone(r.ctx, r.out, { type: 'sine', freq: 110, to: 38, at: 0.05, dur: 0.26, gain: 0.5 })
    this.hiss(r.ctx, r.out, { at: 0.04, dur: 0.18, freq: 900, q: 0.6, gain: 0.2 })
  }

  /** Tiny tick while a captured token zips home (call sparingly). */
  zipTick(): void {
    const r = this.ready()
    if (!r) return
    this.tone(r.ctx, r.out, { type: 'square', freq: 1800, dur: 0.02, gain: 0.05 })
  }

  /** Triumphant major arpeggio when a token reaches the centre. */
  homeGoal(): void {
    const r = this.ready()
    if (!r) return
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((f, i) => {
      this.tone(r.ctx, r.out, { type: 'sine', freq: f, at: i * 0.09, dur: 0.45, gain: 0.22 })
      this.tone(r.ctx, r.out, { type: 'triangle', freq: f, at: i * 0.09, dur: 0.3, gain: 0.06 })
    })
  }

  /** Longer fanfare for the winner. */
  win(): void {
    const r = this.ready()
    if (!r) return
    const seq = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5]
    seq.forEach((f, i) => this.tone(r.ctx, r.out, { type: 'sine', freq: f, at: i * 0.12, dur: 0.4, gain: 0.22 }))
    ;[523.25, 659.25, 783.99, 1046.5].forEach((f) =>
      this.tone(r.ctx, r.out, { type: 'triangle', freq: f, at: 0.85, dur: 1.1, gain: 0.08, attack: 0.05 }),
    )
  }

  /** Short "nope" for forfeits. */
  fail(): void {
    const r = this.ready()
    if (!r) return
    this.tone(r.ctx, r.out, { type: 'square', freq: 330, to: 220, dur: 0.16, gain: 0.12 })
    this.tone(r.ctx, r.out, { type: 'square', freq: 262, to: 170, at: 0.17, dur: 0.22, gain: 0.12 })
  }

  /** Soft UI tap. */
  tap(): void {
    const r = this.ready()
    if (!r) return
    this.tone(r.ctx, r.out, { type: 'sine', freq: 900, to: 600, dur: 0.04, gain: 0.12 })
  }
}

export const sound = new SoundEngine()
