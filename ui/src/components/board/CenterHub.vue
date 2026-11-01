<script setup lang="ts">
import { Trophy } from 'lucide-vue-next'
import { CENTER_BOUNDS } from '@/engine'
import { COLOR_SHADES } from '@/utils/colors'

const b = CENTER_BOUNDS
const style = {
  gridRow: `${b.rowStart} / ${b.rowEnd + 1}`,
  gridColumn: `${b.colStart} / ${b.colEnd + 1}`,
}
</script>

<template>
  <div
    class="hub"
    :style="style"
  >
    <svg
      viewBox="0 0 100 100"
      class="hub__svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="hubShine"
          x1="0"
          y1="0"
          x2="1"
          y2="1"
        >
          <stop
            offset="0"
            stop-color="#fff"
            stop-opacity="0.35"
          />
          <stop
            offset="1"
            stop-color="#000"
            stop-opacity="0.18"
          />
        </linearGradient>
      </defs>
      <polygon
        points="0,0 0,100 50,50"
        :fill="COLOR_SHADES.red.base"
      />
      <polygon
        points="0,0 100,0 50,50"
        :fill="COLOR_SHADES.green.base"
      />
      <polygon
        points="100,0 100,100 50,50"
        :fill="COLOR_SHADES.yellow.base"
      />
      <polygon
        points="0,100 100,100 50,50"
        :fill="COLOR_SHADES.blue.base"
      />
      <rect
        width="100"
        height="100"
        fill="url(#hubShine)"
      />
      <path
        d="M0,0 L50,50 M100,0 L50,50 M0,100 L50,50 M100,100 L50,50"
        stroke="rgba(255,255,255,0.55)"
        stroke-width="1.2"
      />
    </svg>
    <div class="hub__trophy">
      <Trophy
        :size="18"
        stroke-width="2.4"
      />
    </div>
  </div>
</template>

<style scoped>
.hub {
  position: relative;
  overflow: hidden;
  box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.6);
}
.hub__svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.hub__trophy {
  position: absolute;
  inset: 50% auto auto 50%;
  translate: -50% -50%;
  width: 38%;
  height: 38%;
  border-radius: 9999px;
  display: grid;
  place-items: center;
  color: #6b4b00;
  background: radial-gradient(circle at 40% 35%, #fff7d6 0%, #f5d76b 60%, #c99a1a 100%);
  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}
</style>
