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
  /** 翻面（或作答）後自動朗讀日文 */
  ttsAutoplay: boolean
  /** 朗讀速度 0.5–1.5 */
  ttsRate: number
}

export const DEFAULT_SETTINGS: Settings = {
  newCardsPerDay: 20,
  answerMethods: [...ANSWER_METHOD_IDS],
  theme: 'system',
  ttsAutoplay: false,
  ttsRate: 0.9,
}

export const TTS_RATE_MIN = 0.5
export const TTS_RATE_MAX = 1.5

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
    ttsAutoplay: typeof s.ttsAutoplay === 'boolean' ? s.ttsAutoplay : DEFAULT_SETTINGS.ttsAutoplay,
    ttsRate:
      typeof s.ttsRate === 'number' && s.ttsRate >= TTS_RATE_MIN && s.ttsRate <= TTS_RATE_MAX
        ? s.ttsRate
        : DEFAULT_SETTINGS.ttsRate,
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const initial = sanitizeSettings(loadJSON<unknown>('settings', {}))

  const newCardsPerDay = ref(initial.newCardsPerDay)
  const answerMethods = ref<AnswerMethod[]>(initial.answerMethods)
  const theme = ref<Theme>(initial.theme)
  const ttsAutoplay = ref(initial.ttsAutoplay)
  const ttsRate = ref(initial.ttsRate)

  function snapshot(): Settings {
    return {
      newCardsPerDay: newCardsPerDay.value,
      answerMethods: [...answerMethods.value],
      theme: theme.value,
      ttsAutoplay: ttsAutoplay.value,
      ttsRate: ttsRate.value,
    }
  }

  watch([newCardsPerDay, answerMethods, theme, ttsAutoplay, ttsRate], () =>
    saveJSON('settings', snapshot()),
  )

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
    ttsAutoplay.value = next.ttsAutoplay
    ttsRate.value = next.ttsRate
  }

  return {
    newCardsPerDay,
    answerMethods,
    theme,
    ttsAutoplay,
    ttsRate,
    snapshot,
    toggleAnswerMethod,
    restore,
  }
})
