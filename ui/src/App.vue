<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import LudoBoard from '@/components/board/LudoBoard.vue'
import PlayerCard from '@/components/hud/PlayerCard.vue'
import TopBar from '@/components/hud/TopBar.vue'
import type { PlayerColor } from '@/engine'

const game = useGameStore()
const sound = ref(true)
const haptics = ref(true)

onMounted(() => {
  if (!game.state) {
    game.newGame({
      players: [{ color: 'red' }, { color: 'green' }, { color: 'yellow' }, { color: 'blue' }],
    })
  }
})

const seat = (color: PlayerColor) => computed(() => game.playerByColor(color))
const red = seat('red')
const green = seat('green')
const yellow = seat('yellow')
const blue = seat('blue')
const activeColor = computed(() => game.current?.color ?? null)
</script>

<template>
  <div class="app">
    <TopBar
      mode="pass-play"
      :sound="sound"
      :haptics="haptics"
      @toggle-sound="sound = !sound"
      @toggle-haptics="haptics = !haptics"
    />

    <div class="table">
      <div class="row">
        <PlayerCard
          v-if="red"
          :player="red"
          :active="activeColor === 'red'"
          :can-roll="activeColor === 'red'"
          dice-left
        />
        <PlayerCard
          v-if="green"
          :player="green"
          :active="activeColor === 'green'"
          :can-roll="activeColor === 'green'"
        />
      </div>

      <div class="stage">
        <LudoBoard
          :players="game.players"
          :active-color="activeColor"
        />
      </div>

      <div class="row">
        <PlayerCard
          v-if="blue"
          :player="blue"
          :active="activeColor === 'blue'"
          :can-roll="activeColor === 'blue'"
          dice-left
        />
        <PlayerCard
          v-if="yellow"
          :player="yellow"
          :active="activeColor === 'yellow'"
          :can-roll="activeColor === 'yellow'"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.app {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: calc(env(safe-area-inset-top) + 0.6rem) 0.75rem calc(env(safe-area-inset-bottom) + 0.6rem);
  max-width: 560px;
  margin: 0 auto;
  background:
    radial-gradient(ellipse at 50% -10%, rgba(245, 184, 0, 0.18), transparent 55%),
    radial-gradient(ellipse at 50% 110%, rgba(43, 111, 230, 0.2), transparent 55%);
}
.table {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.6rem;
}
.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}
.stage {
  min-height: 0;
  display: grid;
  place-items: center;
}
</style>
