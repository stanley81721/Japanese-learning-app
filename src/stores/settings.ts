import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

import { ANSWER_METHOD_IDS, type AnswerMethod } from '@/lib/answerMethods'
import { loadJSON, saveJSON } from '@/lib/storage'

export type Theme = 'system' | 'light' | 'dark'
export const THEMES: readonly { id: Theme; label: string }[] = [
  { id: 'system', label: '跟隨系統' },
  { id: 'light', label: '淺色' },
  { id: 'dark', label: '深色' },
]

export interface Settings {
  /** 每日新卡上限 */
  newCardsPerDay: number
  /** 啟用的作答方式；每題從中隨機挑選 */
  answerMethods: AnswerMethod[]
  theme: Theme
}

export const DEFAULT_SETTINGS: Settings = {
  newCardsPerDay: 20,
  answerMethods: [...ANSWER_METHOD_IDS],
  theme: 'system',
}

type RawSettings = Partial<Record<keyof Settings, unknown>>

function validNewCards(value: unknown): number | null {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 999
    ? (value as number)
    : null
}

function validMethods(value: unknown): AnswerMethod[] | null {
  if (!Array.isArray(value)) return null
  const methods = ANSWER_METHOD_IDS.filter((m) => value.includes(m))
  return methods.length ? methods : null
}

function validTheme(value: unknown): Theme | null {
  return THEMES.some((t) => t.id === value) ? (value as Theme) : null
}

/** 把存的（或備份檔中的）設定轉成合法值；不合法的欄位用預設值 */
export function sanitizeSettings(raw: unknown): Settings {
  const s: RawSettings = typeof raw === 'object' && raw !== null ? (raw as RawSettings) : {}
  return {
    newCardsPerDay: validNewCards(s.newCardsPerDay) ?? DEFAULT_SETTINGS.newCardsPerDay,
    answerMethods: validMethods(s.answerMethods) ?? [...DEFAULT_SETTINGS.answerMethods],
    theme: validTheme(s.theme) ?? DEFAULT_SETTINGS.theme,
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const initial = sanitizeSettings(loadJSON<unknown>('settings', {}))

  const newCardsPerDay = ref(initial.newCardsPerDay)
  const answerMethods = ref<AnswerMethod[]>(initial.answerMethods)
  const theme = ref<Theme>(initial.theme)

  function snapshot(): Settings {
    return {
      newCardsPerDay: newCardsPerDay.value,
      answerMethods: [...answerMethods.value],
      theme: theme.value,
    }
  }

  watch([newCardsPerDay, answerMethods, theme], () => saveJSON('settings', snapshot()))

  /** 切換作答方式；至少保留一種 */
  function toggleAnswerMethod(method: AnswerMethod) {
    if (answerMethods.value.includes(method)) {
      if (answerMethods.value.length > 1) {
        answerMethods.value = answerMethods.value.filter((m) => m !== method)
      }
    } else {
      answerMethods.value = ANSWER_METHOD_IDS.filter(
        (m) => m === method || answerMethods.value.includes(m),
      )
    }
  }

  /** 套用備份檔中的設定 */
  function restore(raw: unknown) {
    const next = sanitizeSettings(raw)
    newCardsPerDay.value = next.newCardsPerDay
    answerMethods.value = next.answerMethods
    theme.value = next.theme
  }

  return { newCardsPerDay, answerMethods, theme, snapshot, toggleAnswerMethod, restore }
})
