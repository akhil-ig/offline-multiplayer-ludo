<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { YARD, cellForToken, cellKey, type Player } from '@/engine'
import { ZIP_MS, STEP_MS, useAnimStore } from '@/stores/anim'
import GameToken from './GameToken.vue'
import ParticleBurst from './ParticleBurst.vue'

const props = defineProps<{
  players: Player[]
  /** Token indices of the current player that may move. */
  movable?: number[]
  currentColor?: string | null
}>()

const emit = defineEmits<{ select: [tokenIndex: number] }>()

const anim = useAnimStore()

const layer = ref<HTMLElement | null>(null)
const boardPx = ref(0)
let ro: ResizeObserver | null = null

onMounted(() => {
  if (!layer.value) return
  boardPx.value = layer.value.clientWidth
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) boardPx.value = w
    })
    ro.observe(layer.value)
  }
})
onBeforeUnmount(() => ro?.disconnect())

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

/** Layout for N tokens sharing one cell. Targets stay separate so each remains tappable. */
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
    p.tokens.forEach((logicalPos, tokenIndex) => {
      const key = `${p.color}-${tokenIndex}`
      const pos = anim.display[key] ?? logicalPos
      const cell = cellForToken(p.color, pos, tokenIndex)
      const isCurrent = p.color === props.currentColor
      const movable = isCurrent && (props.movable?.includes(tokenIndex) ?? false)
      const t: PlacedToken = {
        key,
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
      // Yard slots are unique per token; everything else may stack. A travelling token never joins a stack.
      if (pos !== YARD && anim.moving !== key) {
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
  <div
    ref="layer"
    class="token-layer"
  >
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
      :board-px="boardPx"
      :moving="anim.moving === t.key"
      :hop-tick="anim.hopTick[t.key]"
      :zip-tick="anim.zipTick[t.key]"
      :move-ms="anim.zipTick[t.key] && anim.moving !== t.key && anim.display[t.key] !== undefined ? ZIP_MS : STEP_MS"
      @select="emit('select', $event)"
    />
    <ParticleBurst
      v-for="b in anim.bursts"
      :key="b.id"
      :cell="b.cell"
      :color="b.color"
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
