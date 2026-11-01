<script setup lang="ts">
import { computed } from 'vue'
import { YARD, cellForToken, cellKey, type Player } from '@/engine'
import GameToken from './GameToken.vue'

const props = defineProps<{
  players: Player[]
  /** Token indices of the current player that may move. */
  movable?: number[]
  currentColor?: string | null
}>()

const emit = defineEmits<{ select: [tokenIndex: number] }>()

interface PlacedToken {
  key: string
  color: Player['color']
  tokenIndex: number
  cell: ReturnType<typeof cellForToken>
  pos: number
  offsetX: number
  offsetY: number
  scale: number
  movable: boolean
  dimmed: boolean
}

/** Layout offsets for N tokens sharing one cell. */
const STACK_LAYOUT: Record<number, { scale: number; offsets: Array<[number, number]> }> = {
  1: { scale: 1, offsets: [[0, 0]] },
  2: {
    scale: 0.68,
    offsets: [
      [-0.22, -0.22],
      [0.22, 0.22],
    ],
  },
  3: {
    scale: 0.58,
    offsets: [
      [0, -0.24],
      [-0.24, 0.2],
      [0.24, 0.2],
    ],
  },
  4: {
    scale: 0.55,
    offsets: [
      [-0.23, -0.23],
      [0.23, -0.23],
      [-0.23, 0.23],
      [0.23, 0.23],
    ],
  },
}

const placed = computed<PlacedToken[]>(() => {
  const groups = new Map<string, PlacedToken[]>()
  const out: PlacedToken[] = []
  for (const p of props.players) {
    p.tokens.forEach((pos, tokenIndex) => {
      const cell = cellForToken(p.color, pos, tokenIndex)
      const isCurrent = p.color === props.currentColor
      const movable = isCurrent && (props.movable?.includes(tokenIndex) ?? false)
      const t: PlacedToken = {
        key: `${p.color}-${tokenIndex}`,
        color: p.color,
        tokenIndex,
        cell,
        pos,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        movable,
        dimmed: isCurrent && (props.movable?.length ?? 0) > 0 && !movable,
      }
      out.push(t)
      // Yard slots are unique per token; everything else may stack.
      if (pos !== YARD) {
        const k = cellKey(cell)
        const g = groups.get(k) ?? []
        g.push(t)
        groups.set(k, g)
      }
    })
  }
  for (const g of groups.values()) {
    if (g.length < 2) continue
    const n = Math.min(g.length, 4)
    const layout = STACK_LAYOUT[n]
    g.forEach((t, i) => {
      const [ox, oy] = layout.offsets[i % n]
      t.offsetX = ox
      t.offsetY = oy
      t.scale = layout.scale
    })
  }
  return out
})
</script>

<template>
  <div class="token-layer">
    <GameToken
      v-for="t in placed"
      :key="t.key"
      :color="t.color"
      :token-index="t.tokenIndex"
      :cell="t.cell"
      :pos="t.pos"
      :offset-x="t.offsetX"
      :offset-y="t.offsetY"
      :scale="t.scale"
      :movable="t.movable"
      :dimmed="t.dimmed"
      @select="emit('select', $event)"
    />
  </div>
</template>

<style scoped>
.token-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
</style>
