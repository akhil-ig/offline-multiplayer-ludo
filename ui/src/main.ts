import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { useGameStore } from './stores/game'
import { useAnimStore } from './stores/anim'
import './style.css'

const pinia = createPinia()
createApp(App).use(pinia).mount('#app')

// Test/debug hook: `?debug` exposes the stores so automated checks can stage board positions.
if (new URLSearchParams(location.search).has('debug')) {
  ;(window as unknown as { __ludo: unknown }).__ludo = { game: useGameStore(pinia), anim: useAnimStore(pinia) }
}
