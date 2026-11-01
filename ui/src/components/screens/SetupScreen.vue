<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Bot, Languages, LogIn, Play, RotateCcw, User, Users, Wifi } from 'lucide-vue-next'
import { COLORS, type NewPlayerSpec, type PlayerColor } from '@/engine'
import { colorVars } from '@/utils/colors'
import { useSettingsStore } from '@/stores/settings'
import { useI18n } from '@/i18n'

const props = defineProps<{ canResume: boolean; rejoinCode?: string; prefillRoom?: string; prefillName?: string; lanError?: string }>()
const emit = defineEmits<{
  start: [players: NewPlayerSpec[]]
  resume: []
  host: [name: string]
  join: [code: string, name: string]
  rejoin: []
}>()

const settings = useSettingsStore()
const { t, lang, toggleLang, colorName } = useI18n()
const count = ref<2 | 3 | 4>(4)

/** Seat layouts: 2P is the classic diagonal (Red vs Yellow). */
const seatsFor: Record<number, PlayerColor[]> = {
  2: ['red', 'yellow'],
  3: ['red', 'green', 'yellow'],
  4: [...COLORS],
}
const seats = computed(() => seatsFor[count.value])

const names = reactive<Record<PlayerColor, string>>({ red: '', green: '', yellow: '', blue: '' })
const lanName = ref(props.prefillName ?? '')
const lanCode = ref(props.prefillRoom ?? '')
const hostAddr = ref('')
const canJoin = computed(() => lanCode.value.trim().length === 4)
/** The Tauri app and `cargo run` serve from this device; a friend's room lives on *their* server. */
const servedLocally = /^(127\.0\.0\.1|localhost|\[::1\])$/.test(location.hostname)

/**
 * Joining a room that lives on another phone means loading that phone's page.
 * Accepts "192.168.43.1", "192.168.43.1:7878" or a full URL pasted from the QR.
 */
function join() {
  const code = lanCode.value.trim().toUpperCase()
  const addr = hostAddr.value.trim()
  if (addr) {
    const withScheme = /^https?:\/\//i.test(addr) ? addr : `http://${addr}`
    try {
      const u = new URL(withScheme)
      if (!u.port && !/^https?:\/\/[^/]+:\d+/.test(withScheme)) u.port = '7878'
      if (u.origin !== location.origin) {
        u.pathname = '/'
        u.search = `?room=${code}&name=${encodeURIComponent(lanName.value)}`
        location.href = u.toString()
        return
      }
    } catch {
      /* fall through and try the local server */
    }
  }
  emit('join', code, lanName.value)
}

onMounted(() => {
  // Arrived via a host's QR/link with a name already chosen: join straight away.
  if (props.prefillRoom && props.prefillName) emit('join', props.prefillRoom, props.prefillName)
})
const bots = reactive<Record<PlayerColor, boolean>>({ red: false, green: false, yellow: false, blue: false })

function start() {
  emit(
    'start',
    seats.value.map((color) => ({ color, name: names[color], isBot: bots[color] })),
  )
}
</script>

<template>
  <section class="setup">
    <header class="setup__hero">
      <h1 class="setup__title">
        LUDO
      </h1>
      <p class="setup__sub">
        Offline · {{ t('passPlay') }}
      </p>
    </header>

    <button
      v-if="props.canResume"
      type="button"
      class="btn btn--ghost"
      data-action="resume"
      @click="emit('resume')"
    >
      <RotateCcw :size="16" />
      {{ t('resume') }}
    </button>
    <button
      v-if="props.rejoinCode"
      type="button"
      class="btn btn--ghost"
      data-action="rejoin"
      @click="emit('rejoin')"
    >
      <Wifi :size="16" />
      {{ t('rejoin', { code: props.rejoinCode }) }}
    </button>

    <div
      class="lan"
      :class="{ 'lan--focus': props.prefillRoom }"
      data-lan
    >
      <label class="setup__label"><Wifi :size="14" /> {{ t('lanSection') }}</label>
      <input
        v-model.trim="lanName"
        class="lan__input"
        :placeholder="t('yourName')"
        maxlength="12"
        data-lan-name
        autocomplete="off"
      >
      <div class="lan__row">
        <button
          type="button"
          class="lan__btn lan__btn--host"
          data-action="lan-host"
          @click="emit('host', lanName)"
        >
          <Wifi :size="15" />
          {{ t('hostWifi') }}
        </button>
        <input
          v-model.trim="lanCode"
          class="lan__input lan__input--code"
          :placeholder="t('roomCodePlaceholder')"
          maxlength="4"
          data-lan-code
          autocapitalize="characters"
          autocomplete="off"
          @input="lanCode = lanCode.toUpperCase()"
        >
        <button
          type="button"
          class="lan__btn"
          :disabled="!canJoin"
          data-action="lan-join"
          @click="join"
        >
          <LogIn :size="15" />
          {{ t('joinRoom') }}
        </button>
      </div>
      <input
        v-if="servedLocally"
        v-model.trim="hostAddr"
        class="lan__input"
        :placeholder="t('hostAddress')"
        inputmode="url"
        data-lan-host
        autocomplete="off"
      >
      <p
        v-if="props.lanError"
        class="lan__error"
        data-lan-error
      >
        {{ t('lanError', { message: props.lanError }) }}
      </p>
      <p
        v-if="servedLocally && (props.lanError || !hostAddr)"
        class="lan__hint"
      >
        {{ t('joinLocalHint') }}
      </p>
    </div>

    <div class="setup__group">
      <label class="setup__label"><Users :size="14" /> {{ t('players') }}</label>
      <div class="seg">
        <button
          v-for="n in [2, 3, 4] as const"
          :key="n"
          type="button"
          class="seg__btn"
          :class="{ 'seg__btn--on': count === n }"
          :data-count="n"
          @click="count = n"
        >
          {{ n }}
        </button>
      </div>
    </div>

    <div class="setup__group">
      <div
        v-for="color in seats"
        :key="color"
        class="seat"
        :style="colorVars(color)"
      >
        <span class="seat__dot" />
        <input
          v-model.trim="names[color]"
          class="seat__input"
          :placeholder="colorName(color)"
          maxlength="12"
          :data-name="color"
          autocomplete="off"
        >
        <button
          type="button"
          class="seat__bot"
          :class="{ 'seat__bot--on': bots[color] }"
          :aria-pressed="bots[color]"
          :aria-label="`${colorName(color)}: ${bots[color] ? t('bot') : t('human')}`"
          :data-bot="color"
          @click="bots[color] = !bots[color]"
        >
          <Bot
            v-if="bots[color]"
            :size="15"
          />
          <User
            v-else
            :size="15"
          />
          <span>{{ bots[color] ? t('bot') : t('human') }}</span>
        </button>
      </div>
    </div>

    <div class="setup__group setup__group--row">
      <label class="chk"><input
        v-model="settings.blockingRule"
        type="checkbox"
      > {{ t('blockingRule') }}</label>
      <label class="chk"><input
        v-model="settings.endAtFirstWinner"
        type="checkbox"
      > {{ t('endAtFirstWinner') }}</label>
    </div>
    <div class="setup__group setup__group--row">
      <label class="chk"><input
        v-model="settings.debugToolbar"
        type="checkbox"
        data-debug-opt
      > {{ t('debugTools') }}</label>
      <button
        type="button"
        class="lang"
        data-lang
        @click="toggleLang"
      >
        <Languages :size="14" />
        {{ lang === 'en' ? 'हिंदी' : 'English' }}
      </button>
    </div>

    <button
      type="button"
      class="btn btn--primary"
      data-action="start"
      @click="start"
    >
      <Play
        :size="18"
        fill="currentColor"
      />
      {{ t('start') }}
    </button>
  </section>
</template>

<style scoped>
.setup {
  height: 100dvh;
  max-width: 420px;
  margin: 0 auto;
  padding: calc(env(safe-area-inset-top) + 1.5rem) 1.25rem calc(env(safe-area-inset-bottom) + 1.5rem);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.9rem;
  overflow-y: auto;
}
.setup__hero {
  text-align: center;
  margin-bottom: 0.25rem;
}
.setup__title {
  margin: 0;
  font-size: 3rem;
  font-weight: 900;
  letter-spacing: 0.3em;
  background: linear-gradient(180deg, #fff3c4, #f5b800 60%, #c98a00);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 3px 0 rgba(0, 0, 0, 0.5));
}
.setup__sub {
  margin: 0.25rem 0 0;
  opacity: 0.65;
  font-size: 0.85rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.setup__group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.setup__group--row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  font-size: 0.8rem;
  opacity: 0.9;
}
.setup__label {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  opacity: 0.7;
}
.seg {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.4rem;
}
.seg__btn {
  padding: 0.6rem;
  border-radius: 0.8rem;
  font-weight: 800;
  font-size: 1.1rem;
  color: #fff;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.12);
}
.seg__btn--on {
  background: linear-gradient(180deg, #ffd95c, #f5b800);
  color: #3b2a00;
  border-color: #ffe68a;
  box-shadow: 0 4px 0 #a87c00;
}
.seat {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.4rem 0.4rem 0.4rem 0.7rem;
  border-radius: 0.9rem;
  background: color-mix(in srgb, var(--c) 16%, rgba(255, 255, 255, 0.04));
  border: 1px solid color-mix(in srgb, var(--c) 45%, transparent);
}
.seat__dot {
  width: 1rem;
  height: 1rem;
  flex: none;
  border-radius: 9999px;
  background: radial-gradient(circle at 35% 30%, var(--c-light), var(--c) 60%, var(--c-dark));
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}
.seat__input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: 0;
  outline: 0;
  color: #fff;
  font-weight: 600;
  font-size: 1rem;
}
.seat__input::placeholder {
  color: rgba(255, 255, 255, 0.45);
}
.seat__bot {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.35rem 0.6rem;
  border-radius: 0.6rem;
  font-size: 0.72rem;
  font-weight: 700;
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
}
.seat__bot--on {
  color: #3b2a00;
  background: linear-gradient(180deg, #ffd95c, #f5b800);
  border-color: #ffe68a;
}
.lan {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.7rem;
  border-radius: 1rem;
  background: rgba(43, 111, 230, 0.1);
  border: 1px solid rgba(134, 177, 255, 0.3);
}
.lan--focus {
  box-shadow: 0 0 0 2px rgba(134, 177, 255, 0.5), 0 0 24px rgba(43, 111, 230, 0.35);
}
.lan__row {
  display: grid;
  grid-template-columns: 1fr 5.2rem auto;
  gap: 0.4rem;
}
.lan__input {
  min-width: 0;
  padding: 0.5rem 0.7rem;
  border-radius: 0.7rem;
  color: #fff;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.14);
  outline: 0;
}
.lan__input--code {
  text-align: center;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  font-weight: 800;
}
.lan__input::placeholder {
  color: rgba(255, 255, 255, 0.45);
  letter-spacing: normal;
  text-transform: none;
  font-weight: 500;
}
.lan__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.5rem 0.7rem;
  border-radius: 0.7rem;
  font-size: 0.8rem;
  font-weight: 800;
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  white-space: nowrap;
}
.lan__btn--host {
  color: #0d1b3a;
  background: linear-gradient(180deg, #86b1ff, #2b6fe6);
  border-color: #a9c6ff;
}
.lan__btn:disabled {
  opacity: 0.4;
}
.lan__error {
  margin: 0;
  font-size: 0.75rem;
  color: #ff8a8e;
}
.lan__hint {
  margin: 0;
  font-size: 0.72rem;
  line-height: 1.35;
  opacity: 0.75;
}
.chk {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.lang {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.7rem;
  border-radius: 9999px;
  font-size: 0.78rem;
  font-weight: 700;
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
}
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.85rem 1rem;
  border-radius: 1rem;
  font-weight: 800;
  font-size: 1rem;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.07);
}
.btn--ghost {
  opacity: 0.9;
}
.btn--primary {
  color: #3b2a00;
  background: linear-gradient(180deg, #ffd95c, #f5b800);
  border-color: #ffe68a;
  box-shadow: 0 5px 0 #a87c00, 0 10px 20px rgba(0, 0, 0, 0.4);
}
.btn--primary:active {
  transform: translateY(3px);
  box-shadow: 0 2px 0 #a87c00;
}
</style>
