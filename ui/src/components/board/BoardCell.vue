<script setup lang="ts">
import { computed } from 'vue'
import { ArrowRight, Star } from 'lucide-vue-next'
import { START_OFFSET, type Cell, type CellInfo } from '@/engine'
import { colorVars } from '@/utils/colors'

const props = defineProps<{ cell: Cell; info: CellInfo }>()

const style = computed(() => ({
  gridRow: props.cell.row,
  gridColumn: props.cell.col,
  ...(props.info.color ? colorVars(props.info.color) : {}),
}))

/** Start-cell arrows point in the direction of travel along the track. */
const arrowRotation = computed(() => {
  if (!props.info.isStart || !props.info.color) return 0
  const idx = START_OFFSET[props.info.color]
  return idx === 0 ? 0 : idx === 13 ? 90 : idx === 26 ? 180 : 270
})
</script>

<template>
  <div
    class="cell"
    :class="{
      'cell--colored': info.color,
      'cell--lane': info.kind === 'lane',
      'cell--start': info.isStart,
      'cell--star': info.isStar,
    }"
    :style="style"
    :data-track="info.trackIndex"
  >
    <Star
      v-if="info.isStar"
      class="cell__icon cell__icon--star"
      :size="14"
      stroke-width="2.2"
      fill="currentColor"
    />
    <ArrowRight
      v-else-if="info.isStart"
      class="cell__icon cell__icon--arrow"
      :size="14"
      stroke-width="3"
      :style="{ rotate: `${arrowRotation}deg` }"
    />
  </div>
</template>

<style scoped>
.cell {
  position: relative;
  display: grid;
  place-items: center;
  background: linear-gradient(160deg, #fffdf7, #f1eadb);
  box-shadow:
    inset 0 0 0 1px rgba(90, 70, 40, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
}
.cell--colored {
  background:
    radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--c-light) 50%, var(--c)) 0%, var(--c) 70%, color-mix(in srgb, var(--c) 70%, var(--c-dark)) 100%);
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
}
.cell__icon {
  width: 55%;
  height: 55%;
}
.cell__icon--star {
  color: #b79a5c;
  filter: drop-shadow(0 1px 0 rgba(255, 255, 255, 0.8));
  animation: shimmer 2.8s ease-in-out infinite;
}
.cell__icon--arrow {
  color: rgba(255, 255, 255, 0.92);
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.35));
}
@keyframes shimmer {
  0%, 100% { opacity: 0.75; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.12); }
}
@media (prefers-reduced-motion: reduce) {
  .cell__icon--star { animation: none; }
}
</style>
