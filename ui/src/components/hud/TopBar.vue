<script setup lang="ts">
import { Languages, Smartphone, Vibrate, VibrateOff, Volume2, VolumeX, Wifi } from 'lucide-vue-next'
import { useI18n } from '@/i18n'

const props = defineProps<{
  mode: 'pass-play' | 'lan-host' | 'lan-join'
  roomLabel?: string
  connected?: boolean
  sound: boolean
  haptics: boolean
}>()

const emit = defineEmits<{ 'toggle-sound': []; 'toggle-haptics': []; 'open-room': [] }>()
const { t, lang, toggleLang } = useI18n()
</script>

<template>
  <header class="topbar">
    <button
      type="button"
      class="pill"
      data-room-pill
      @click="emit('open-room')"
    >
      <Smartphone
        v-if="props.mode === 'pass-play'"
        :size="14"
      />
      <Wifi
        v-else
        :size="14"
      />
      <span>{{ props.mode === 'pass-play' ? t('passPlay') : props.roomLabel ?? t('lan') }}</span>
      <span
        v-if="props.mode !== 'pass-play'"
        class="pill__dot"
        :class="{ 'pill__dot--off': !props.connected }"
        data-conn
      />
    </button>
    <h1 class="title">
      LUDO
    </h1>
    <div class="actions">
      <button
        type="button"
        class="icon-btn icon-btn--text"
        :aria-label="t('language')"
        data-lang
        @click="toggleLang"
      >
        <Languages :size="15" />
        <span>{{ lang === 'en' ? 'हि' : 'EN' }}</span>
      </button>
      <button
        type="button"
        class="icon-btn"
        :aria-pressed="props.sound"
        aria-label="toggle sound"
        :title="t('toggleSound')"
        @click="emit('toggle-sound')"
      >
        <Volume2
          v-if="props.sound"
          :size="18"
        />
        <VolumeX
          v-else
          :size="18"
        />
      </button>
      <button
        type="button"
        class="icon-btn"
        :aria-pressed="props.haptics"
        aria-label="toggle haptics"
        :title="t('toggleHaptics')"
        @click="emit('toggle-haptics')"
      >
        <Vibrate
          v-if="props.haptics"
          :size="18"
        />
        <VibrateOff
          v-else
          :size="18"
        />
      </button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 0.5rem;
}
.pill {
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.7rem;
  border-radius: 9999px;
  font-size: 0.72rem;
  font-weight: 600;
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
}
.pill__dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  background: #6fe39b;
  box-shadow: 0 0 6px #6fe39b;
}
.pill__dot--off {
  background: #ffd95c;
  box-shadow: 0 0 6px #ffd95c;
  animation: blink 1s ease-in-out infinite;
}
@keyframes blink {
  50% { opacity: 0.3; }
}
.title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 900;
  letter-spacing: 0.28em;
  background: linear-gradient(180deg, #fff3c4, #f5b800 60%, #c98a00);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 2px 0 rgba(0, 0, 0, 0.5));
}
.actions {
  justify-self: end;
  display: flex;
  gap: 0.35rem;
}
.icon-btn {
  min-width: 2.1rem;
  height: 2.1rem;
  display: grid;
  place-items: center;
  border-radius: 0.7rem;
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
}
.icon-btn--text {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0 0.5rem;
  font-size: 0.72rem;
  font-weight: 800;
}
.icon-btn[aria-pressed='false'] {
  opacity: 0.5;
}
</style>
