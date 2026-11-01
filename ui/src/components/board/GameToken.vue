<script setup lang="ts">
import { computed } from 'vue'
import { GRID_SIZE, type Cell, type PlayerColor } from '@/engine'
import { colorVars } from '@/utils/colors'

const props = defineProps<{
  color: PlayerColor
  tokenIndex: number
  cell: Cell
  pos: number
  /** Offset within a shared cell, as a fraction of the cell (-0.5..0.5). */
  offsetX?: number
  offsetY?: number
  scale?: number
  movable?: boolean
  dimmed?: boolean
}>()

const emit = defineEmits<{ select: [tokenIndex: number] }>()

/**
 * The button itself is scaled and offset (not just the visual body), so the
 * tap target of a stacked token never sits under a neighbour.
 */
const style = computed(() => {
  const unit = 100 / GRID_SIZE
  const scale = props.scale ?? 1
  const size = unit * scale
  const cx = (props.cell.col - 1 + 0.5 + (props.offsetX ?? 0)) * unit
  const cy = (props.cell.row - 1 + 0.5 + (props.offsetY ?? 0)) * unit
  return {
    left: `${cx - size / 2}%`,
    top: `${cy - size / 2}%`,
    width: `${size}%`,
    height: `${size}%`,
    ...colorVars(props.color),
  }
})
</script>

<template>
  <button
    type="button"
    class="token"
    :class="{ 'token--movable': movable, 'token--dimmed': dimmed }"
    :style="style"
    :data-token="`${color}-${tokenIndex}`"
    :data-pos="pos"
    :aria-label="`${color} token ${tokenIndex + 1}`"
    :disabled="!movable"
    @click="emit('select', tokenIndex)"
  >
    <span class="token__ring" />
    <span class="token__body">
      <span class="token__gloss" />
      <span class="token__pip" />
    </span>
  </button>
</template>

<style scoped>
.token {
  position: absolute;
  padding: 0;
  border: 0;
  background: transparent;
  display: grid;
  place-items: center;
  transition:
    left 120ms ease,
    top 120ms ease,
    width 120ms ease,
    height 120ms ease,
    opacity 200ms ease;
  pointer-events: none;
  z-index: 5;
}
.token--movable {
  pointer-events: auto;
  cursor: pointer;
  z-index: 7;
}
.token--dimmed {
  opacity: 0.6;
}
.token__body {
  position: relative;
  width: 78%;
  height: 78%;
  border-radius: 9999px;
  background:
    radial-gradient(circle at 35% 28%, var(--c-light) 0%, var(--c) 45%, var(--c-dark) 100%);
  box-shadow:
    0 3px 0 var(--c-dark),
    0 6px 8px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
  transition: transform 160ms ease;
}
.token__gloss {
  position: absolute;
  left: 18%;
  top: 10%;
  width: 42%;
  height: 28%;
  border-radius: 9999px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0));
}
.token__pip {
  position: absolute;
  inset: 32%;
  border-radius: 9999px;
  background: radial-gradient(circle at 40% 35%, #fffaf0, #e7dcc5);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.35);
}
.token__ring {
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  border: 2px solid var(--c-light);
  opacity: 0;
  pointer-events: none;
}
.token--movable .token__body {
  transform: translateY(-4px);
}
.token--movable .token__ring {
  animation: radar 1.3s ease-out infinite;
}
@keyframes radar {
  0% { opacity: 0.9; transform: scale(0.75); }
  100% { opacity: 0; transform: scale(1.6); }
}
@media (prefers-reduced-motion: reduce) {
  .token--movable .token__ring { animation: none; opacity: 0.9; }
}
</style>
