<script setup lang="ts">
import { useAnimStore } from '@/stores/anim'
import { colorVars } from '@/utils/colors'
import { useI18n } from '@/i18n'

const anim = useAnimStore()
const { t } = useI18n()
</script>

<template>
  <Transition name="banner">
    <div
      v-if="anim.banner"
      class="banner"
      :style="colorVars(anim.banner.color)"
      data-banner
    >
      <span class="banner__emoji">{{ anim.banner.emoji }}</span>
      <span class="banner__text">{{ t(anim.banner.key, anim.banner.params) }}</span>
    </div>
  </Transition>
</template>

<style scoped>
.banner {
  position: absolute;
  left: 50%;
  top: 50%;
  translate: -50% -50%;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 1.1rem;
  border-radius: 9999px;
  font-size: 1.05rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  white-space: nowrap;
  color: #fff;
  background: linear-gradient(180deg, color-mix(in srgb, var(--c) 85%, white), var(--c-dark));
  border: 2px solid rgba(255, 255, 255, 0.75);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.55), 0 0 24px color-mix(in srgb, var(--c) 60%, transparent);
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.35);
  pointer-events: none;
}
.banner__emoji { font-size: 1.3rem; }
.banner-enter-active { transition: all 220ms cubic-bezier(0.2, 1.5, 0.4, 1); }
.banner-leave-active { transition: all 180ms ease-in; }
.banner-enter-from { opacity: 0; transform: scale(0.5); }
.banner-leave-to { opacity: 0; transform: scale(1.1) translateY(-10px); }
</style>
