<script setup lang="ts">
import { computed } from 'vue'
import { Bot, Crown, LogOut, Minus, Play, Plus, Wifi, WifiOff } from 'lucide-vue-next'
import QrcodeVue from 'qrcode.vue'
import { useNetStore } from '@/stores/net'
import { useI18n } from '@/i18n'

const props = defineProps<{ bots: number }>()
const emit = defineEmits<{ start: []; leave: []; 'update:bots': [n: number] }>()

const net = useNetStore()
const { t } = useI18n()

const total = computed(() => net.players.length + props.bots)
const canStart = computed(() => net.isHost && total.value >= 2 && total.value <= 4)
const maxBots = computed(() => Math.max(0, 4 - net.players.length))
</script>

<template>
  <section
    class="lobby"
    data-lobby-screen
  >
    <header class="lobby__head">
      <span
        class="lobby__conn"
        :class="{ 'lobby__conn--off': !net.connected }"
      >
        <Wifi
          v-if="net.connected"
          :size="14"
        />
        <WifiOff
          v-else
          :size="14"
        />
        {{ net.connected ? t('connected') : t('reconnecting') }}
      </span>
      <span class="lobby__label">{{ t('room') }}</span>
      <span
        class="lobby__code"
        data-room-code
      >{{ net.code || '····' }}</span>
    </header>

    <div
      v-if="net.joinUrl"
      class="lobby__qr"
    >
      <QrcodeVue
        :value="net.joinUrl"
        :size="170"
        level="M"
        background="#fffdf7"
        foreground="#15162b"
      />
    </div>
    <p class="lobby__hint">
      {{ t('lobbyScan') }}
    </p>
    <code
      v-if="net.joinUrl"
      class="lobby__url"
    >{{ net.joinUrl }}</code>

    <ul class="lobby__list">
      <li
        v-for="p in net.players"
        :key="p.id"
        class="lobby__row"
        :class="{ 'lobby__row--off': !p.connected }"
        :data-lobby-player="p.name"
      >
        <span
          class="lobby__dot"
          :class="{ 'lobby__dot--on': p.connected }"
        />
        <span class="lobby__name">{{ p.name }}</span>
        <span
          v-if="p.isHost"
          class="lobby__badge"
        ><Crown :size="11" /> {{ t('hostBadge') }}</span>
        <span
          v-if="p.id === net.playerId"
          class="lobby__badge lobby__badge--you"
        >{{ t('youBadge') }}</span>
      </li>
      <li
        v-for="i in props.bots"
        :key="`bot-${i}`"
        class="lobby__row"
      >
        <Bot :size="14" />
        <span class="lobby__name">{{ t('bot') }} {{ i }}</span>
      </li>
    </ul>

    <div
      v-if="net.isHost"
      class="lobby__bots"
    >
      <span>{{ t('bots') }}</span>
      <button
        type="button"
        class="lobby__step"
        :disabled="props.bots <= 0"
        :aria-label="t('removeBot')"
        data-bot-minus
        @click="emit('update:bots', props.bots - 1)"
      >
        <Minus :size="14" />
      </button>
      <strong>{{ props.bots }}</strong>
      <button
        type="button"
        class="lobby__step"
        :disabled="props.bots >= maxBots"
        :aria-label="t('addBot')"
        data-bot-plus
        @click="emit('update:bots', props.bots + 1)"
      >
        <Plus :size="14" />
      </button>
    </div>

    <p
      v-if="net.error"
      class="lobby__error"
      data-lobby-error
    >
      {{ t('lanError', { message: net.error }) }}
    </p>

    <button
      v-if="net.isHost"
      type="button"
      class="btn btn--primary"
      :disabled="!canStart"
      data-action="lan-start"
      @click="emit('start')"
    >
      <Play
        :size="18"
        fill="currentColor"
      />
      {{ canStart ? t('startGame') : t('needTwo') }}
    </button>
    <p
      v-else
      class="lobby__wait"
    >
      {{ t('waitingHost') }}
    </p>

    <button
      type="button"
      class="btn"
      data-action="lan-leave"
      @click="emit('leave')"
    >
      <LogOut :size="16" />
      {{ t('leave') }}
    </button>
  </section>
</template>

<style scoped>
.lobby {
  min-height: 100dvh;
  max-width: 420px;
  margin: 0 auto;
  padding: calc(env(safe-area-inset-top) + 1.2rem) 1.25rem calc(env(safe-area-inset-bottom) + 1.2rem);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.7rem;
  overflow-y: auto;
  text-align: center;
}
.lobby__head {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
}
.lobby__conn {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.7rem;
  color: #6fe39b;
}
.lobby__conn--off {
  color: #ffd95c;
}
.lobby__label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  opacity: 0.6;
}
.lobby__code {
  font-size: 2.6rem;
  font-weight: 900;
  letter-spacing: 0.35em;
  color: #ffd95c;
  text-shadow: 0 3px 0 rgba(0, 0, 0, 0.5);
}
.lobby__qr {
  padding: 0.6rem;
  border-radius: 1rem;
  background: #fffdf7;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
}
.lobby__hint {
  margin: 0;
  font-size: 0.8rem;
  opacity: 0.75;
}
.lobby__url {
  font-size: 0.72rem;
  opacity: 0.7;
  word-break: break-all;
}
.lobby__list {
  width: 100%;
  list-style: none;
  margin: 0.3rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.lobby__row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.8rem;
  border-radius: 0.8rem;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.lobby__row--off {
  opacity: 0.5;
}
.lobby__dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 9999px;
  background: #ffd95c;
}
.lobby__dot--on {
  background: #6fe39b;
  box-shadow: 0 0 6px #6fe39b;
}
.lobby__name {
  flex: 1;
  text-align: left;
  font-weight: 700;
}
.lobby__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.1rem 0.45rem;
  border-radius: 9999px;
  font-size: 0.65rem;
  font-weight: 700;
  color: #3b2a00;
  background: #ffd95c;
}
.lobby__badge--you {
  color: #fff;
  background: rgba(255, 255, 255, 0.15);
}
.lobby__bots {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.85rem;
}
.lobby__step {
  width: 1.8rem;
  height: 1.8rem;
  display: grid;
  place-items: center;
  border-radius: 0.5rem;
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
}
.lobby__step:disabled {
  opacity: 0.35;
}
.lobby__error {
  margin: 0;
  font-size: 0.8rem;
  color: #ff8a8e;
}
.lobby__wait {
  margin: 0.3rem 0;
  font-size: 0.85rem;
  opacity: 0.8;
}
.btn {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.8rem 1rem;
  border-radius: 1rem;
  font-weight: 800;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.07);
}
.btn--primary {
  color: #3b2a00;
  background: linear-gradient(180deg, #ffd95c, #f5b800);
  border-color: #ffe68a;
  box-shadow: 0 5px 0 #a87c00;
}
.btn--primary:disabled {
  opacity: 0.5;
  box-shadow: none;
}
</style>
