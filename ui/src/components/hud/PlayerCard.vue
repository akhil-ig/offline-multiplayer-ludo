<script setup lang="ts">
import { computed } from 'vue'
import { Bot, Crown } from 'lucide-vue-next'
import { GOAL, YARD, type Player } from '@/engine'
import { colorVars } from '@/utils/colors'
import DiceBox from './DiceBox.vue'

const props = defineProps<{
  player: Player
  active?: boolean
  dice?: number | null
  canRoll?: boolean
  rolling?: boolean
  /** Put the dice on the left so it sits near the outer thumb on that side. */
  diceLeft?: boolean
}>()

const emit = defineEmits<{ roll: [] }>()

const homeCount = computed(() => props.player.tokens.filter((t) => t === GOAL).length)
const outCount = computed(() => props.player.tokens.filter((t) => t !== YARD && t !== GOAL).length)
</script>

<template>
  <div
    class="card"
    :class="{ 'card--active': active, 'card--done': player.rank !== null, 'card--dice-left': diceLeft }"
    :style="colorVars(player.color)"
    :data-player="player.color"
  >
    <DiceBox
      :value="active ? dice ?? null : null"
      :can-roll="canRoll"
      :rolling="rolling"
      @roll="emit('roll')"
    />
    <div class="card__body">
      <div class="card__name">
        <span class="card__dot" />
        <span class="truncate">{{ player.name }}</span>
        <Bot
          v-if="player.isBot"
          :size="14"
          class="opacity-70"
        />
        <Crown
          v-if="player.rank === 1"
          :size="14"
          class="text-yellow-300"
        />
      </div>
      <div class="card__tokens">
        <span
          v-for="(t, i) in player.tokens"
          :key="i"
          class="card__tok"
          :class="{ 'card__tok--home': t === GOAL, 'card__tok--out': t !== GOAL && t !== YARD }"
        />
        <span class="card__meta">{{ homeCount }} home · {{ outCount }} out</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
  padding: 0.5rem 0.6rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
  transition: background 250ms ease, border-color 250ms ease, box-shadow 250ms ease;
}
.card:not(.card--dice-left) {
  flex-direction: row-reverse;
}
.card--active {
  background: color-mix(in srgb, var(--c) 18%, rgba(255, 255, 255, 0.05));
  border-color: color-mix(in srgb, var(--c-light) 70%, transparent);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    0 0 20px color-mix(in srgb, var(--c) 45%, transparent);
}
.card--done {
  opacity: 0.6;
}
.card__body {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.card__name {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 700;
  font-size: 0.9rem;
  letter-spacing: 0.01em;
}
.card__dot {
  width: 0.7rem;
  height: 0.7rem;
  flex: none;
  border-radius: 9999px;
  background: radial-gradient(circle at 35% 30%, var(--c-light), var(--c) 60%, var(--c-dark));
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}
.card__tokens {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.card__tok {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.15);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2);
}
.card__tok--out {
  background: var(--c);
}
.card__tok--home {
  background: #ffd84d;
  box-shadow: 0 0 6px #ffd84d;
}
.card__meta {
  margin-left: 0.3rem;
  font-size: 0.65rem;
  opacity: 0.6;
  white-space: nowrap;
}
</style>
