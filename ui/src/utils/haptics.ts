/** navigator.vibrate wrapper. Silently no-ops where unsupported (iOS Safari, desktop). */
export class Haptics {
  enabled = true
  fired = 0

  private buzz(pattern: number | number[]): void {
    if (!this.enabled) return
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern)
        this.fired++
      }
    } catch {
      /* ignore */
    }
  }

  tap(): void {
    this.buzz(10)
  }
  dice(): void {
    this.buzz([15, 30, 15])
  }
  hop(): void {
    this.buzz(8)
  }
  unlock(): void {
    this.buzz([20, 30, 40])
  }
  capture(): void {
    this.buzz([60, 40, 120])
  }
  goal(): void {
    this.buzz([30, 30, 30, 30, 90])
  }
  win(): void {
    this.buzz([80, 50, 80, 50, 200])
  }
  fail(): void {
    this.buzz([120])
  }
}

export const haptics = new Haptics()
