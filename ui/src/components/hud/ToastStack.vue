<script setup lang="ts">
import { useToast } from '@/composables/useToast'

const { toasts } = useToast()
</script>

<template>
  <div
    class="toasts"
    aria-live="polite"
  >
    <TransitionGroup name="toast">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="toast"
        :class="`toast--${t.tone}`"
        data-toast
      >
        <span v-if="t.emoji">{{ t.emoji }}</span>
        <span>{{ t.text }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toasts {
  position: fixed;
  left: 50%;
  top: calc(env(safe-area-inset-top) + 3.4rem);
  translate: -50% 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  z-index: 50;
  pointer-events: none;
}
.toast {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.9rem;
  border-radius: 9999px;
  font-size: 0.85rem;
  font-weight: 700;
  white-space: nowrap;
  color: #fff;
  background: rgba(20, 20, 40, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}
.toast--success { border-color: #6fe39b; }
.toast--warn { border-color: #ffd95c; }
.toast--danger { border-color: #ff8a8e; }
.toast-enter-active, .toast-leave-active { transition: all 220ms ease; }
.toast-enter-from { opacity: 0; transform: translateY(-8px) scale(0.95); }
.toast-leave-to { opacity: 0; transform: translateY(-4px) scale(0.98); }
</style>
