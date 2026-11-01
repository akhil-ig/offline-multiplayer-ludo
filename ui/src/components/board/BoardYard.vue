<script setup lang="ts">
import { computed } from 'vue'
import { YARD_BOUNDS, type PlayerColor } from '@/engine'
import { colorVars } from '@/utils/colors'

const props = defineProps<{ color: PlayerColor; active?: boolean }>()

const style = computed(() => {
  const b = YARD_BOUNDS[props.color]
  return {
    gridRow: `${b.rowStart} / ${b.rowEnd + 1}`,
    gridColumn: `${b.colStart} / ${b.colEnd + 1}`,
    ...colorVars(props.color),
  }
})
</script>

<template>
  <div
    class="yard"
    :class="{ 'yard--active': active }"
    :style="style"
    :data-yard="color"
  >
    <div class="yard__panel">
      <span
        v-for="i in 4"
        :key="i"
        class="yard__slot"
      />
    </div>
  </div>
</template>

<style scoped>
.yard {
  position: relative;
  background:
    radial-gradient(circle at 30% 25%, color-mix(in srgb, var(--c-light) 55%, var(--c)) 0%, var(--c) 55%, var(--c-dark) 140%);
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, 0.35),
    inset 0 -3px 0 rgba(0, 0, 0, 0.25);
  transition: box-shadow 300ms ease;
}
.yard--active {
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, 0.45),
    inset 0 -3px 0 rgba(0, 0, 0, 0.25),
    0 0 0 3px color-mix(in srgb, var(--c-light) 80%, white),
    0 0 22px 4px var(--c-light);
  z-index: 1;
}
.yard__panel {
  position: absolute;
  inset: 16%;
  border-radius: 18%;
  background: linear-gradient(160deg, #fffdf7 0%, #f3ecdc 100%);
  box-shadow:
    inset 0 3px 6px rgba(0, 0, 0, 0.12),
    0 2px 0 rgba(255, 255, 255, 0.5);
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  padding: 12%;
  gap: 12%;
}
.yard__slot {
  border-radius: 9999px;
  background: radial-gradient(circle at 50% 45%, var(--c-tint) 0%, color-mix(in srgb, var(--c) 35%, #efe6d6) 100%);
  box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.22);
}
</style>
