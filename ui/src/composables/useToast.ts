import { reactive, readonly } from 'vue'

export type ToastTone = 'info' | 'success' | 'warn' | 'danger'

export interface Toast {
  id: number
  text: string
  tone: ToastTone
  emoji?: string
}

const toasts = reactive<Toast[]>([])
let nextId = 1

export function pushToast(text: string, tone: ToastTone = 'info', emoji?: string, ttl = 1700): void {
  const t: Toast = { id: nextId++, text, tone }
  if (emoji) t.emoji = emoji
  toasts.push(t)
  if (toasts.length > 3) toasts.shift()
  setTimeout(() => {
    const i = toasts.findIndex((x) => x.id === t.id)
    if (i >= 0) toasts.splice(i, 1)
  }, ttl)
}

export function useToast() {
  return { toasts: readonly(toasts), pushToast }
}
