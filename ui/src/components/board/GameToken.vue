<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
  /** Currently travelling: drawn above everything else. */
  moving?: boolean
  /** Bumped once per forward hop; triggers the parabolic bounce. */
  hopTick?: number
  /** Bumped once per reverse-zip cell when captured. */
  zipTick?: number
  /** How long the slide between two cells takes. */
  moveMs?: number
  /** Rendered board size in px; enables transform-based positioning (compositor only). */
  boardPx: number
}>()

const emit = defineEmits<{ select: [tokenIndex: number] }>()

const body = ref<HTMLElement | null>(null)

/**
 * Positioned purely with `transform` so sliding never triggers layout.
 * The button itself is scaled and offset (not just the visual body), so the
 * tap target of a stacked token never sits under a neighbour.
 */
const style = computed(() => {
  const unitPx = props.boardPx / GRID_SIZE
  const scale = props.scale ?? 1
  const cx = (props.cell.col - 1 + 0.5 + (props.offsetX ?? 0)) * unitPx
  const cy = (props.cell.row - 1 + 0.5 + (props.offsetY ?? 0)) * unitPx
  return {
    width: `${unitPx}px`,
    height: `${unitPx}px`,
    transform: `translate(${(cx - unitPx / 2).toFixed(2)}px, ${(cy - unitPx / 2).toFixed(2)}px) scale(${scale})`,
    '--move-ms': `${props.moveMs ?? 110}ms`,
    ...colorVars(props.color),
  }
})

const HOP: Keyframe[] = [
  { transform: 'translateY(0) scale(1, 1)', offset: 0 },
  { transform: 'translateY(-14px) scale(1.18, 1.18)', offset: 0.45 },
  { transform: 'translateY(0) scale(1.14, 0.84)', offset: 0.8 },
  { transform: 'translateY(0) scale(0.96, 1.06)', offset: 0.92 },
  { transform: 'translateY(0) scale(1, 1)', offset: 1 },
]

const UNLOCK: Keyframe[] = [
  { transform: 'translateY(0) scale(0.6)', offset: 0 },
  { transform: 'translateY(-22px) scale(1.3)', offset: 0.5 },
  { transform: 'translateY(0) scale(1.15, 0.85)', offset: 0.82 },
  { transform: 'translateY(0) scale(1)', offset: 1 },
]

const ZIP: Keyframe[] = [
  { transform: 'scale(0.92)', opacity: 0.85 },
  { transform: 'scale(1)', opacity: 1 },
]

function animate(frames: Keyframe[], duration: number) {
  if (!body.value || typeof body.value.animate !== 'function') return
  body.value.animate(frames, { duration, easing: 'ease-out' })
}

watch(
  () => props.hopTick,
  () => animate(props.pos === 0 && (props.hopTick ?? 0) > 0 && props.moveMs === undefined ? UNLOCK : HOP, props.pos === 0 ? 220 : 130),
)
watch(
  () => props.zipTick,
  () => animate(ZIP, 60),
)
</script>

<template>
  <button
    type="button"
    class="token"
    :class="{ 'token--movable': movable, 'token--dimmed': dimmed, 'token--moving': moving }"
    :style="style"
    :data-token="`${color}-${tokenIndex}`"
    :data-pos="pos"
    :aria-label="`${color} token ${tokenIndex + 1}`"
    :disabled="!movable"
    @click="emit('select', tokenIndex)"
  >
    <span class="token__ring" />
    <span
      ref="body"
      class="token__body"
    >
      <span class="token__gloss" />
      <span class="token__pip" />
    </span>
  </button>
</template>

<style scoped>
.token {
  position: absolute;
  left: 0;
  top: 0;
  padding: 0;
  border: 0;
  background: transparent;
  display: grid;
  place-items: center;
  transform-origin: center;
  transition:
    transform var(--move-ms) linear,
    opacity 200ms ease;
  will-change: transform;
  pointer-events: none;
  z-index: 5;
}
.token--movable {
  pointer-events: auto;
  cursor: pointer;
  z-index: 7;
}
.token--moving {
  z-index: 9;
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
  .token { transition: none; }
  .token--movable .token__ring { animation: none; opacity: 0.9; }
}
</style>
