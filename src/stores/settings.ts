import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

import { ANSWER_METHOD_IDS, type AnswerMethod } from '@/lib/answerMethods'
import { loadJSON, saveJSON } from '@/lib/storage'

export interface Settings {
  /** 每日新卡上限 */
  newCardsPerDay: number
  /** 啟用的作答方式；每題從中隨機挑選 */
  answerMethods: AnswerMethod[]
}

export const DEFAULT_SETTINGS: Settings = {
  newCardsPerDay: 20,
  answerMethods: [...ANSWER_METHOD_IDS],
}

function validNewCards(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0
}

function validMethods(value: unknown): AnswerMethod[] | null {
  if (!Array.isArray(value)) return null
  const methods = value.filter((m): m is AnswerMethod => ANSWER_METHOD_IDS.includes(m))
  return methods.length ? methods : null
}

// 其他設定（發音、深色模式）在 M6、M7 加入
export const useSettingsStore = defineStore('settings', () => {
  const saved = loadJSON<Partial<Record<keyof Settings, unknown>>>('settings', {})

  const newCardsPerDay = ref(
    validNewCards(saved.newCardsPerDay) ? saved.newCardsPerDay : DEFAULT_SETTINGS.newCardsPerDay,
  )
  const answerMethods = ref<AnswerMethod[]>(
    validMethods(saved.answerMethods) ?? [...DEFAULT_SETTINGS.answerMethods],
  )

  watch([newCardsPerDay, answerMethods], () => {
    saveJSON('settings', {
      newCardsPerDay: newCardsPerDay.value,
      answerMethods: answerMethods.value,
    } satisfies Settings)
  })

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

  return { newCardsPerDay, answerMethods, toggleAnswerMethod }
})
