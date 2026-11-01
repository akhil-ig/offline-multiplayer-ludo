import type { PlayerColor } from '@/engine'

export interface ColorShades {
  base: string
  dark: string
  light: string
  /** Soft tint used for yard panels and highlights. */
  tint: string
}

export const COLOR_SHADES: Readonly<Record<PlayerColor, ColorShades>> = {
  red: { base: '#e2383f', dark: '#8f1b21', light: '#ff8a8e', tint: '#ffe3e4' },
  green: { base: '#1ea65a', dark: '#0f5c33', light: '#6fe39b', tint: '#dcf7e6' },
  yellow: { base: '#f5b800', dark: '#8e6a00', light: '#ffe16b', tint: '#fff3c7' },
  blue: { base: '#2b6fe6', dark: '#163f8f', light: '#86b1ff', tint: '#dde9ff' },
}

/** Inline CSS custom properties for a colour, consumed by token/yard styles. */
export function colorVars(color: PlayerColor): Record<string, string> {
  const c = COLOR_SHADES[color]
  return { '--c': c.base, '--c-dark': c.dark, '--c-light': c.light, '--c-tint': c.tint }
}
