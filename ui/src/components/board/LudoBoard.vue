<script setup lang="ts">
import { computed } from 'vue'
import { COLORS, GRID_SIZE, allCells, cellKey, describeCell, type Player, type PlayerColor } from '@/engine'
import BoardCell from './BoardCell.vue'
import BoardYard from './BoardYard.vue'
import CenterHub from './CenterHub.vue'
import TokenLayer from './TokenLayer.vue'

const props = defineProps<{
  players: Player[]
  activeColor?: PlayerColor | null
  movable?: number[]
}>()

const emit = defineEmits<{ select: [tokenIndex: number] }>()

/** Only track and lane cells are rendered individually; yards and the hub span their regions. */
const pathCells = computed(() =>
  allCells()
    .map((cell) => ({ cell, info: describeCell(cell), key: cellKey(cell) }))
    .filter(({ info }) => info.kind === 'track' || info.kind === 'lane'),
)

const gridStyle = {
  gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
  gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`,
}
</script>

<template>
  <div
    class="board"
    role="img"
    aria-label="Ludo board"
  >
    <!-- The token layer must share the grid's exact box (inside the frame padding),
         otherwise every token drifts by the padding and a slightly wrong cell size. -->
    <div class="board__inner">
      <div
        class="board__grid"
        :style="gridStyle"
      >
        <BoardYard
          v-for="color in COLORS"
          :key="color"
          :color="color"
          :active="color === props.activeColor"
        />
        <BoardCell
          v-for="c in pathCells"
          :key="c.key"
          :cell="c.cell"
          :info="c.info"
        />
        <CenterHub />
      </div>
      <TokenLayer
        :players="props.players"
        :movable="props.movable"
        :current-color="props.activeColor"
        @select="emit('select', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.board {
  position: relative;
  aspect-ratio: 1 / 1;
  width: min(96vw, 520px, calc(100dvh - 17rem));
  border-radius: 14px;
  padding: 6px;
  background: linear-gradient(160deg, #3a2d1d, #1d1610);
  box-shadow:
    0 0 0 2px rgba(255, 220, 160, 0.25),
    0 18px 40px rgba(0, 0, 0, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
}
.board__inner {
  position: relative;
  width: 100%;
  height: 100%;
}
.board__grid {
  display: grid;
  width: 100%;
  height: 100%;
  border-radius: 9px;
  overflow: hidden;
  background: #efe7d6;
}
</style>
