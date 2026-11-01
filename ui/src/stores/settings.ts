import { defineStore } from 'pinia'
import { reactive, watch } from 'vue'

export type Lang = 'en' | 'hi'

export interface Settings {
  sound: boolean
  haptics: boolean
  autoMoveSingle: boolean
  blockingRule: boolean
  endAtFirstWinner: boolean
  lang: Lang
  debugToolbar: boolean
}

const KEY = 'ludo.settings.v1'

const DEFAULTS: Settings = {
  sound: true,
  haptics: true,
  autoMoveSingle: true,
  blockingRule: false,
  endAtFirstWinner: false,
  lang: 'en',
  debugToolbar: false,
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    return { ...DEFAULTS }
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const s = reactive<Settings>(load())
  watch(
    s,
    (v) => {
      try {
        localStorage.setItem(KEY, JSON.stringify(v))
      } catch {
        /* storage unavailable (private mode); settings stay in memory */
      }
    },
    { deep: true },
  )
  return s
})
