<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  value: number | null
  /** The player this dice belongs to is on turn and may roll. */
  canRoll?: boolean
  rolling?: boolean
  flip?: boolean
}>()

const emit = defineEmits<{ roll: [] }>()

/** Pip layout on a 3x3 grid for faces 1..6. */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

const pips = computed(() => (props.value ? PIPS[props.value] : []))
</script>

<template>
  <button
    type="button"
    class="dice"
    :class="{ 'dice--active': canRoll, 'dice--rolling': rolling, 'dice--flip': flip }"
    :disabled="!canRoll || rolling"
    :aria-label="value ? `dice showing ${value}` : 'roll dice'"
    @click="emit('roll')"
  >
    <span class="dice__face">
      <span
        v-for="i in 9"
        :key="i"
        class="dice__pip"
        :class="{ 'dice__pip--on': pips.includes(i - 1) }"
      />
    </span>
  </button>
</template>

<style scoped>
.dice {
  width: 3.1rem;
  height: 3.1rem;
  flex: none;
  border: 0;
  padding: 0;
  border-radius: 0.8rem;
  background: linear-gradient(160deg, #ffffff, #d9d9df);
  box-shadow:
    0 4px 0 #9a9aa6,
    0 8px 14px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  display: grid;
  place-items: center;
  opacity: 0.45;
  transition: opacity 200ms ease, transform 120ms ease, box-shadow 200ms ease;
}
.dice--active {
  opacity: 1;
  cursor: pointer;
  animation: nudge 1.4s ease-in-out infinite;
  box-shadow:
    0 4px 0 #9a9aa6,
    0 8px 14px rgba(0, 0, 0, 0.5),
    0 0 0 3px rgba(255, 255, 255, 0.35),
    0 0 18px 2px rgba(255, 255, 255, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
}
.dice--active:active {
  transform: translateY(3px);
  box-shadow: 0 1px 0 #9a9aa6, 0 3px 6px rgba(0, 0, 0, 0.4);
}
.dice__face {
  width: 70%;
  height: 70%;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 8%;
}
.dice__pip {
  border-radius: 9999px;
  background: transparent;
  transition: background 80ms ease;
}
.dice__pip--on {
  background: radial-gradient(circle at 40% 35%, #3a3a46, #0e0e14);
  box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.6);
}
@keyframes nudge {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-3px) rotate(-4deg); }
}
@media (prefers-reduced-motion: reduce) {
  .dice--active { animation: none; }
}
</style>
