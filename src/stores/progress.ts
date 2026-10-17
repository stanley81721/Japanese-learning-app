import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { dayKey, newProgress, schedule, type CardProgress, type Grade } from '@/lib/srs'
import { loadVersioned, saveVersioned } from '@/lib/storage'

const PROGRESS_KEY = 'progress'
const HISTORY_KEY = 'history'
const VERSION = 1

export interface DayStats {
  /** 當天評分次數 */
  reviews: number
  /** 其中按「再一次」的次數 */
  again: number
  /** 當天第一次學習的新卡數 */
  newCards: number
}

/** 所有卡片的 SRS 進度與每日統計，存在 localStorage */
export const useProgressStore = defineStore('progress', () => {
  const loadedCards = loadVersioned<Record<string, CardProgress>>(PROGRESS_KEY, VERSION)
  const loadedHistory = loadVersioned<Record<string, DayStats>>(HISTORY_KEY, VERSION)

  const cards = ref<Record<string, CardProgress>>(loadedCards ?? {})
  const history = ref<Record<string, DayStats>>(loadedHistory ?? {})

  // 存的資料格式無法辨識時不要覆寫，以免把使用者的進度清掉；
  // 使用者主動匯入或全部重置時才解除
  const readOnly = ref(loadedCards === null || loadedHistory === null)
  const saveFailed = ref(false)

  function persist() {
    if (readOnly.value) return
    const ok =
      saveVersioned(PROGRESS_KEY, VERSION, cards.value) &&
      saveVersioned(HISTORY_KEY, VERSION, history.value)
    saveFailed.value = !ok
  }

  function get(key: string): CardProgress | undefined {
    return cards.value[key]
  }

  function getOrNew(key: string, now: number): CardProgress {
    return cards.value[key] ?? newProgress(key, now)
  }

  function statsFor(now: number): DayStats {
    return history.value[dayKey(now)] ?? { reviews: 0, again: 0, newCards: 0 }
  }

  /** 對一張卡評分，更新進度與當日統計，回傳新的進度 */
  function review(key: string, grade: Grade, now: number): CardProgress {
    const before = getOrNew(key, now)
    const after = schedule(before, grade, now)
    cards.value = { ...cards.value, [key]: after }

    const today = statsFor(now)
    history.value = {
      ...history.value,
      [dayKey(now)]: {
        reviews: today.reviews + 1,
        again: today.again + (grade === 'again' ? 1 : 0),
        newCards: today.newCards + (before.state === 'new' ? 1 : 0),
      },
    }

    persist()
    return after
  }

  /** 清除某個資料集的所有進度（設定頁會用到） */
  function resetDataset(datasetId: string) {
    const prefix = `${datasetId}:`
    cards.value = Object.fromEntries(
      Object.entries(cards.value).filter(([key]) => !key.startsWith(prefix)),
    )
    persist()
  }

  /** 用備份檔取代全部進度（已先由 parseBackup 驗證） */
  function replaceAll(
    nextCards: Record<string, CardProgress>,
    nextHistory: Record<string, DayStats>,
  ) {
    cards.value = nextCards
    history.value = nextHistory
    readOnly.value = false
    persist()
  }

  /** 清除所有進度與每日統計 */
  function resetAll() {
    replaceAll({}, {})
  }

  const totalCards = computed(() => Object.keys(cards.value).length)

  return {
    cards,
    history,
    readOnly,
    saveFailed,
    totalCards,
    get,
    getOrNew,
    statsFor,
    review,
    resetDataset,
    replaceAll,
    resetAll,
  }
})
