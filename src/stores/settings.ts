import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

import { loadJSON, saveJSON } from '@/lib/storage'

export interface Settings {
  /** 每日新卡上限 */
  newCardsPerDay: number
}

export const DEFAULT_SETTINGS: Settings = {
  newCardsPerDay: 20,
}

// 其他設定（作答方式、發音、深色模式）在 M6 加入
export const useSettingsStore = defineStore('settings', () => {
  const saved = loadJSON<Partial<Settings>>('settings', {})
  const newCardsPerDay = ref(
    Number.isInteger(saved.newCardsPerDay) && saved.newCardsPerDay! >= 0
      ? saved.newCardsPerDay!
      : DEFAULT_SETTINGS.newCardsPerDay,
  )

  watch(newCardsPerDay, (value) => {
    saveJSON('settings', { newCardsPerDay: value } satisfies Settings)
  })

  return { newCardsPerDay }
})
