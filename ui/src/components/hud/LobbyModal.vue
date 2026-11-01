<script setup lang="ts">
import { X, Wifi } from 'lucide-vue-next'
import QrcodeVue from 'qrcode.vue'
import { useI18n } from '@/i18n'

const props = defineProps<{
  open: boolean
  joinUrl: string
  roomCode: string
  preview?: boolean
}>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
</script>

<template>
  <Transition name="modal">
    <div
      v-if="props.open"
      class="modal"
      data-lobby
      @click.self="emit('close')"
    >
      <div class="modal__card">
        <header class="modal__head">
          <Wifi :size="18" />
          <h2 class="modal__title">
            {{ t('lobbyTitle') }}
          </h2>
          <button
            type="button"
            class="modal__close"
            :aria-label="t('close')"
            @click="emit('close')"
          >
            <X :size="18" />
          </button>
        </header>
        <div class="modal__qr">
          <QrcodeVue
            :value="props.joinUrl"
            :size="190"
            level="M"
            background="#fffdf7"
            foreground="#15162b"
          />
        </div>
        <p class="modal__hint">
          {{ t('lobbyScan') }}
        </p>
        <div class="modal__code">
          <span class="modal__label">{{ t('roomCode') }}</span>
          <span class="modal__value">{{ props.roomCode }}</span>
        </div>
        <code class="modal__url">{{ props.joinUrl }}</code>
        <p
          v-if="props.preview"
          class="modal__preview"
        >
          {{ t('lobbyPreview') }}
        </p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal {
  position: fixed;
  inset: 0;
  z-index: 45;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(8, 8, 20, 0.75);
  backdrop-filter: blur(5px);
}
.modal__card {
  width: min(92vw, 340px);
  padding: 1rem 1.1rem 1.2rem;
  border-radius: 1.3rem;
  text-align: center;
  background: linear-gradient(170deg, #1d1f3a, #0f1020);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.6);
}
.modal__head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.8rem;
}
.modal__title {
  flex: 1;
  margin: 0;
  text-align: left;
  font-size: 1.05rem;
  font-weight: 800;
}
.modal__close {
  width: 2rem;
  height: 2rem;
  display: grid;
  place-items: center;
  border-radius: 0.6rem;
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
}
.modal__qr {
  display: inline-block;
  padding: 0.6rem;
  border-radius: 1rem;
  background: #fffdf7;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
}
.modal__hint {
  margin: 0.8rem 0 0.6rem;
  font-size: 0.8rem;
  opacity: 0.75;
}
.modal__code {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.6rem;
}
.modal__label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  opacity: 0.6;
}
.modal__value {
  font-size: 1.6rem;
  font-weight: 900;
  letter-spacing: 0.3em;
  color: #ffd95c;
}
.modal__url {
  display: block;
  margin-top: 0.4rem;
  font-size: 0.72rem;
  opacity: 0.7;
  word-break: break-all;
}
.modal__preview {
  margin: 0.8rem 0 0;
  font-size: 0.72rem;
  color: #ffd95c;
  opacity: 0.9;
}
.modal-enter-active, .modal-leave-active { transition: opacity 180ms ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
