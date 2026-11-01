<script setup lang="ts">
import { Trophy } from 'lucide-vue-next'
import type { Player, PlayerColor } from '@/engine'
import { colorVars } from '@/utils/colors'
import { useI18n } from '@/i18n'

const props = defineProps<{ ranking: PlayerColor[]; players: Player[] }>()
const emit = defineEmits<{ again: []; menu: [] }>()

const { t, displayName } = useI18n()
const nameOf = (c: PlayerColor) => displayName(props.players.find((p) => p.color === c)) || c
const MEDALS = ['🥇', '🥈', '🥉', '4️⃣']
</script>

<template>
  <div
    class="win"
    data-win
  >
    <div class="win__card">
      <div
        class="win__trophy"
        :style="colorVars(ranking[0])"
      >
        <Trophy :size="34" />
      </div>
      <h2 class="win__title">
        {{ t('winsTitle', { name: nameOf(ranking[0]) }) }}
      </h2>
      <ol class="win__list">
        <li
          v-for="(c, i) in ranking"
          :key="c"
          class="win__row"
          :style="colorVars(c)"
        >
          <span class="win__medal">{{ MEDALS[i] }}</span>
          <span class="win__dot" />
          <span class="win__name">{{ nameOf(c) }}</span>
        </li>
      </ol>
      <div class="win__actions">
        <button
          type="button"
          class="btn btn--primary"
          data-action="again"
          @click="emit('again')"
        >
          {{ t('playAgain') }}
        </button>
        <button
          type="button"
          class="btn"
          data-action="menu"
          @click="emit('menu')"
        >
          {{ t('mainMenu') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.win {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(8, 8, 20, 0.78);
  backdrop-filter: blur(6px);
}
.win__card {
  width: min(92vw, 360px);
  padding: 1.5rem 1.25rem;
  border-radius: 1.4rem;
  text-align: center;
  background: linear-gradient(170deg, #1d1f3a, #0f1020);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.6);
  animation: pop 420ms cubic-bezier(0.2, 1.4, 0.4, 1);
}
.win__trophy {
  width: 4.5rem;
  height: 4.5rem;
  margin: 0 auto 0.75rem;
  display: grid;
  place-items: center;
  border-radius: 9999px;
  color: #3b2a00;
  background: radial-gradient(circle at 40% 35%, #fff7d6 0%, #f5d76b 60%, #c99a1a 100%);
  box-shadow: 0 0 0 6px color-mix(in srgb, var(--c) 50%, transparent), 0 8px 20px rgba(0, 0, 0, 0.5);
}
.win__title {
  margin: 0 0 1rem;
  font-size: 1.5rem;
  font-weight: 900;
}
.win__list {
  list-style: none;
  margin: 0 0 1.25rem;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.win__row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.8rem;
  border-radius: 0.8rem;
  background: color-mix(in srgb, var(--c) 14%, rgba(255, 255, 255, 0.04));
  border: 1px solid color-mix(in srgb, var(--c) 40%, transparent);
}
.win__medal { font-size: 1.1rem; }
.win__dot {
  width: 0.8rem;
  height: 0.8rem;
  border-radius: 9999px;
  background: radial-gradient(circle at 35% 30%, var(--c-light), var(--c) 60%, var(--c-dark));
}
.win__name { font-weight: 700; }
.win__actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.btn {
  padding: 0.8rem 1rem;
  border-radius: 0.9rem;
  font-weight: 800;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.07);
}
.btn--primary {
  color: #3b2a00;
  background: linear-gradient(180deg, #ffd95c, #f5b800);
  border-color: #ffe68a;
  box-shadow: 0 4px 0 #a87c00;
}
@keyframes pop {
  from { transform: scale(0.8); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
</style>
