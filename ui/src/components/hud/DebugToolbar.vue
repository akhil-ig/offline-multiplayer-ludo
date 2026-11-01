<script setup lang="ts">
import { ref } from 'vue'
import { Bug, ChevronDown, ChevronUp } from 'lucide-vue-next'
import { GOAL } from '@/engine'
import { useGameStore } from '@/stores/game'

const props = defineProps<{ canRoll: boolean }>()
const emit = defineEmits<{ force: [value: number] }>()

const game = useGameStore()
const open = ref(false)

/** Puts the current player three steps from victory to exercise the end-game flow. */
function endgamePreset() {
  const me = game.current
  if (!me) return
  game.debugSetTokens(me.color, [GOAL, GOAL, GOAL, 54])
}
</script>

<template>
  <div
    class="dbg"
    data-debug
  >
    <button
      type="button"
      class="dbg__toggle"
      data-debug-toggle
      @click="open = !open"
    >
      <Bug :size="13" />
      <span>Debug</span>
      <ChevronUp
        v-if="open"
        :size="13"
      />
      <ChevronDown
        v-else
        :size="13"
      />
    </button>
    <div
      v-if="open"
      class="dbg__panel"
    >
      <span class="dbg__label">Force roll</span>
      <button
        v-for="n in 6"
        :key="n"
        type="button"
        class="dbg__die"
        :data-force="n"
        :disabled="!props.canRoll"
        @click="emit('force', n)"
      >
        {{ n }}
      </button>
      <button
        type="button"
        class="dbg__btn"
        data-debug-endgame
        :disabled="!props.canRoll"
        @click="endgamePreset"
      >
        Endgame preset
      </button>
    </div>
  </div>
</template>

<style scoped>
.dbg {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
}
.dbg__toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
  font-size: 0.68rem;
  font-weight: 700;
  color: #ffd95c;
  background: rgba(245, 184, 0, 0.1);
  border: 1px solid rgba(245, 184, 0, 0.35);
}
.dbg__panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  padding: 0.4rem 0.5rem;
  border-radius: 0.8rem;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.dbg__label {
  font-size: 0.68rem;
  opacity: 0.7;
  margin-right: 0.2rem;
}
.dbg__die {
  width: 1.9rem;
  height: 1.9rem;
  border-radius: 0.5rem;
  font-weight: 800;
  color: #111;
  background: #fff;
  border: 0;
  box-shadow: 0 2px 0 #9a9aa6;
}
.dbg__die:disabled, .dbg__btn:disabled {
  opacity: 0.35;
}
.dbg__btn {
  padding: 0.3rem 0.6rem;
  border-radius: 0.5rem;
  font-size: 0.7rem;
  font-weight: 700;
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
}
</style>
