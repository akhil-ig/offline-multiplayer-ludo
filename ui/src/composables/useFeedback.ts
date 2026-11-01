import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useAnimStore } from '@/stores/anim'
import { useSettingsStore } from '@/stores/settings'
import { haptics } from '@/utils/haptics'
import { sound } from '@/utils/sound'

/**
 * Binds sound + haptics to the animation hook points, honours the settings
 * toggles, and unlocks the AudioContext on the first user gesture.
 */
export function useFeedback() {
  const anim = useAnimStore()
  const settings = useSettingsStore()
  const offs: Array<() => void> = []

  const unlockOnce = () => {
    sound.unlock()
    window.removeEventListener('pointerdown', unlockOnce)
    window.removeEventListener('keydown', unlockOnce)
  }

  onMounted(() => {
    sound.enabled = settings.sound
    haptics.enabled = settings.haptics
    window.addEventListener('pointerdown', unlockOnce, { passive: true })
    window.addEventListener('keydown', unlockOnce)

    offs.push(
      anim.on('dice', () => {
        sound.diceRoll()
        haptics.dice()
      }),
      anim.on('hop', ({ step }) => {
        sound.tokenHop(step ?? 0)
        haptics.hop()
      }),
      anim.on('land', () => sound.tokenLand()),
      anim.on('unlock', () => {
        sound.tokenUnlock()
        haptics.unlock()
      }),
      anim.on('capture', () => {
        sound.capture()
        haptics.capture()
      }),
      anim.on('zip', ({ step }) => {
        if ((step ?? 0) % 3 === 0) sound.zipTick()
      }),
      anim.on('goal', () => {
        sound.homeGoal()
        haptics.goal()
      }),
      anim.on('win', () => {
        sound.win()
        haptics.win()
      }),
      anim.on('fail', () => {
        sound.fail()
        haptics.fail()
      }),
      anim.on('tap', () => sound.tap()),
    )
  })

  watch(
    () => settings.sound,
    (v) => {
      sound.enabled = v
      if (v) sound.unlock()
    },
  )
  watch(
    () => settings.haptics,
    (v) => (haptics.enabled = v),
  )

  onBeforeUnmount(() => {
    offs.forEach((off) => off())
    window.removeEventListener('pointerdown', unlockOnce)
    window.removeEventListener('keydown', unlockOnce)
  })
}
