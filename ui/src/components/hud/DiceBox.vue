<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  value: number | null
  /** The player this dice belongs to is on turn and may roll. */
  canRoll?: boolean
  rolling?: boolean
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

/** Cube face placement: opposite faces add up to 7. */
const FACES = [
  { n: 1, t: 'rotateY(0deg)' },
  { n: 6, t: 'rotateY(180deg)' },
  { n: 3, t: 'rotateY(90deg)' },
  { n: 4, t: 'rotateY(-90deg)' },
  { n: 2, t: 'rotateX(90deg)' },
  { n: 5, t: 'rotateX(-90deg)' },
]

/** Cube rotation that brings face `n` to the front. */
const SHOW: Record<number, string> = {
  1: 'rotateX(0deg) rotateY(0deg)',
  6: 'rotateX(0deg) rotateY(-180deg)',
  3: 'rotateX(0deg) rotateY(-90deg)',
  4: 'rotateX(0deg) rotateY(90deg)',
  2: 'rotateX(-90deg) rotateY(0deg)',
  5: 'rotateX(90deg) rotateY(0deg)',
}

const cubeStyle = computed(() => ({ transform: SHOW[props.value ?? 1] }))
</script>

<template>
  <button
    type="button"
    class="dice"
    :class="{ 'dice--active': canRoll, 'dice--rolling': rolling, 'dice--blank': value === null && !rolling }"
    :disabled="!canRoll || rolling"
    :aria-label="value ? `dice showing ${value}` : 'roll dice'"
    :data-dice="value ?? ''"
    @click="emit('roll')"
  >
    <span class="dice__scene">
      <span
        class="dice__cube"
        :style="cubeStyle"
      >
        <span
          v-for="f in FACES"
          :key="f.n"
          class="dice__face"
          :style="{ transform: `${f.t} translateZ(var(--half))` }"
        >
          <span
            v-for="i in 9"
            :key="i"
            class="dice__pip"
            :class="{ 'dice__pip--on': PIPS[f.n].includes(i - 1) }"
          />
        </span>
      </span>
    </span>
  </button>
</template>

<style scoped>
.dice {
  position: relative;
  --size: 3rem;
  --half: calc(var(--size) / 2);
  width: var(--size);
  height: var(--size);
  flex: none;
  border: 0;
  padding: 0;
  background: transparent;
  display: grid;
  place-items: center;
  opacity: 0.45;
  perspective: 220px;
  transition: opacity 200ms ease, transform 120ms ease, filter 200ms ease;
}
.dice--active {
  opacity: 1;
  cursor: pointer;
  animation: nudge 1.4s ease-in-out infinite;
}
/* Static glow layer instead of an animated filter: rasterised once, composited each frame. */
.dice--active::before {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 26%;
  box-shadow: 0 0 14px 3px rgba(255, 255, 255, 0.45);
  pointer-events: none;
}
.dice--active:active {
  transform: translateY(3px) scale(0.96);
}
.dice--blank {
  opacity: 0.35;
}
.dice--blank .dice__pip {
  opacity: 0;
}
.dice__scene {
  width: var(--size);
  height: var(--size);
  display: block;
  transform-style: preserve-3d;
}
.dice__cube {
  position: relative;
  width: 100%;
  height: 100%;
  display: block;
  transform-style: preserve-3d;
  transition: transform 450ms cubic-bezier(0.2, 0.9, 0.3, 1.1);
  will-change: transform;
}
.dice--rolling .dice__cube {
  animation: tumble 450ms linear infinite;
  transition: none;
}
.dice__face {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 10%;
  padding: 16%;
  border-radius: 18%;
  background: linear-gradient(160deg, #ffffff, #dcdce3);
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.12),
    inset 0 2px 0 rgba(255, 255, 255, 0.9);
  backface-visibility: hidden;
}
.dice__pip {
  border-radius: 9999px;
}
.dice__pip--on {
  background: radial-gradient(circle at 40% 35%, #3a3a46, #0e0e14);
  box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.6);
}
@keyframes tumble {
  0% { transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg); }
  100% { transform: rotateX(720deg) rotateY(540deg) rotateZ(360deg); }
}
@keyframes nudge {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-3px) rotate(-4deg); }
}
@media (prefers-reduced-motion: reduce) {
  .dice--active { animation: none; }
  .dice--rolling .dice__cube { animation: none; }
  .dice__cube { transition: none; }
}
</style>
