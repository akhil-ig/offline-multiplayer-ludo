<script setup lang="ts">
import { ref } from 'vue'
import { Bug, ChevronDown, ChevronUp, Wifi } from 'lucide-vue-next'
import { COLORS, GOAL, type PlayerColor } from '@/engine'
import { useGameStore } from '@/stores/game'
import { useI18n } from '@/i18n'
import { colorVars } from '@/utils/colors'

const props = defineProps<{ canRoll: boolean }>()
const emit = defineEmits<{ force: [value: number]; restart: [count: 2 | 4]; lobby: [] }>()

const game = useGameStore()
const { t, colorName } = useI18n()
const open = ref(false)

/** Puts the current player three steps from victory to exercise the end-game flow. */
function endgamePreset() {
  const me = game.current
  if (!me) return
  game.debugSetTokens(me.color, [GOAL, GOAL, GOAL, 54])
}

function toggleBot(color: PlayerColor) {
  const p = game.playerByColor(color)
  if (p) game.setBot(color, !p.isBot)
}
</script>

<template>
  <div
    class="dbg"
    data-debug
  >
    <button
      type="button"
      class="dbg__toggle"
      data-debug-toggle
      @click="open = !open"
    >
      <Bug :size="13" />
      <span>Debug</span>
      <ChevronUp
        v-if="open"
        :size="13"
      />
      <ChevronDown
        v-else
        :size="13"
      />
    </button>
    <div
      v-if="open"
      class="dbg__panel"
    >
      <div class="dbg__row">
        <span class="dbg__label">{{ t('forceRoll') }}</span>
        <button
          v-for="n in 6"
          :key="n"
          type="button"
          class="dbg__die"
          :data-force="n"
          :disabled="!props.canRoll"
          @click="emit('force', n)"
        >
          {{ n }}
        </button>
      </div>
      <div class="dbg__row">
        <span class="dbg__label">{{ t('bots') }}</span>
        <button
          v-for="c in COLORS"
          :key="c"
          type="button"
          class="dbg__seat"
          :class="{ 'dbg__seat--on': game.playerByColor(c)?.isBot, 'dbg__seat--absent': !game.playerByColor(c) }"
          :style="colorVars(c)"
          :disabled="!game.playerByColor(c)"
          :data-debug-bot="c"
          :aria-pressed="game.playerByColor(c)?.isBot ?? false"
          :title="colorName(c)"
          @click="toggleBot(c)"
        >
          <span class="dbg__dot" />
        </button>
        <button
          type="button"
          class="dbg__btn"
          data-debug-2p
          @click="emit('restart', 2)"
        >
          {{ t('restart2p') }}
        </button>
        <button
          type="button"
          class="dbg__btn"
          data-debug-4p
          @click="emit('restart', 4)"
        >
          {{ t('restart4p') }}
        </button>
      </div>
      <div class="dbg__row">
        <button
          type="button"
          class="dbg__btn"
          data-debug-endgame
          :disabled="!props.canRoll"
          @click="endgamePreset"
        >
          {{ t('endgamePreset') }}
        </button>
        <button
          type="button"
          class="dbg__btn"
          data-debug-lobby
          @click="emit('lobby')"
        >
          <Wifi :size="12" />
          {{ t('lobbyTitle') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dbg {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
}
.dbg__toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
  font-size: 0.68rem;
  font-weight: 700;
  color: #ffd95c;
  background: rgba(245, 184, 0, 0.1);
  border: 1px solid rgba(245, 184, 0, 0.35);
}
.dbg__panel {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.4rem 0.5rem;
  border-radius: 0.8rem;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.dbg__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
}
.dbg__label {
  font-size: 0.68rem;
  opacity: 0.7;
  margin-right: 0.2rem;
}
.dbg__die {
  width: 1.9rem;
  height: 1.9rem;
  border-radius: 0.5rem;
  font-weight: 800;
  color: #111;
  background: #fff;
  border: 0;
  box-shadow: 0 2px 0 #9a9aa6;
}
.dbg__die:disabled, .dbg__btn:disabled {
  opacity: 0.35;
}
.dbg__btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.6rem;
  border-radius: 0.5rem;
  font-size: 0.7rem;
  font-weight: 700;
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
}
.dbg__seat {
  width: 1.7rem;
  height: 1.7rem;
  display: grid;
  place-items: center;
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.15);
}
.dbg__seat--on {
  background: color-mix(in srgb, var(--c) 35%, transparent);
  border-color: var(--c-light);
  box-shadow: 0 0 8px color-mix(in srgb, var(--c) 60%, transparent);
}
.dbg__seat--absent {
  opacity: 0.25;
}
.dbg__dot {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 9999px;
  background: radial-gradient(circle at 35% 30%, var(--c-light), var(--c) 60%, var(--c-dark));
}
</style>
