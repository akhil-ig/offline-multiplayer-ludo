<script setup lang="ts">
import { TRACK_LENGTH } from '@/engine'
</script>

<template>
  <main class="flex h-[100dvh] items-center justify-center">
    <p class="text-sm opacity-70">
      Ludo engine ready. Track length: {{ TRACK_LENGTH }}. Board UI arrives in M2.
    </p>
  </main>
</template>
