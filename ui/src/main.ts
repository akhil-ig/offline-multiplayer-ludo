import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { useGameStore } from './stores/game'
import { useAnimStore } from './stores/anim'
import { sound } from './utils/sound'
import { haptics } from './utils/haptics'
import './style.css'

const pinia = createPinia()
createApp(App).use(pinia).mount('#app')

// Test/debug hook: `?debug` exposes the stores so automated checks can stage board positions.
if (new URLSearchParams(location.search).has('debug')) {
  ;(window as unknown as { __ludo: unknown }).__ludo = { game: useGameStore(pinia), anim: useAnimStore(pinia), sound, haptics }
}

// Offline app shell for the web build. Secure contexts only; the Tauri shell serves from
// the embedded server and never needs it.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline shell is a progressive enhancement */
    })
  })
}
