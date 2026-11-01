<script setup lang="ts">
import { computed } from 'vue'
import { GRID_SIZE, type Cell, type PlayerColor } from '@/engine'
import { colorVars } from '@/utils/colors'

const props = defineProps<{ cell: Cell; color: PlayerColor; count?: number }>()

const unit = 100 / GRID_SIZE
const style = computed(() => ({
  left: `${(props.cell.col - 0.5) * unit}%`,
  top: `${(props.cell.row - 0.5) * unit}%`,
  ...colorVars(props.color),
}))

/** Deterministic spread so the burst looks the same in tests and screenshots. */
const particles = computed(() =>
  Array.from({ length: props.count ?? 12 }, (_, i) => {
    const a = (i / (props.count ?? 12)) * Math.PI * 2
    const r = 22 + (i % 3) * 9
    return { id: i, dx: `${Math.cos(a) * r}px`, dy: `${Math.sin(a) * r}px`, s: 0.6 + (i % 4) * 0.15 }
  }),
)
</script>

<template>
  <div
    class="burst"
    :style="style"
    aria-hidden="true"
  >
    <span
      v-for="p in particles"
      :key="p.id"
      class="burst__p"
      :style="{ '--dx': p.dx, '--dy': p.dy, '--s': p.s }"
    />
  </div>
</template>

<style scoped>
.burst {
  position: absolute;
  width: 0;
  height: 0;
  pointer-events: none;
  z-index: 12;
}
.burst__p {
  position: absolute;
  left: -4px;
  top: -4px;
  width: 8px;
  height: 8px;
  border-radius: 9999px;
  background: radial-gradient(circle at 35% 30%, var(--c-light), var(--c));
  box-shadow: 0 0 6px var(--c-light);
  animation: fly 620ms cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
}
@keyframes fly {
  0% { transform: translate(0, 0) scale(var(--s)); opacity: 1; }
  100% { transform: translate(var(--dx), var(--dy)) scale(0.2); opacity: 0; }
}
</style>
