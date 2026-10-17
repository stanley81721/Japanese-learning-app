import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { QUIZ_MODE_IDS, type QuizModeId, type StudyCard } from '@/lib/quizModes'
import { loadJSON, saveJSON } from '@/lib/storage'
import { shuffle } from '@/lib/shuffle'

export type SessionStatus = 'setup' | 'active' | 'finished'

/** 一次翻卡練習的狀態。M3 會把評分接到記憶演算法。 */
export const useStudySessionStore = defineStore('studySession', () => {
  const cards = ref<StudyCard[]>([])
  const index = ref(0)
  const flipped = ref(false)
  /** 卡片 key → 是否答對 */
  const results = ref<Record<string, boolean>>({})

  const savedModes = loadJSON<QuizModeId[]>('study-modes', [...QUIZ_MODE_IDS])
  const enabledModes = ref<QuizModeId[]>(savedModes.filter((id) => QUIZ_MODE_IDS.includes(id)))

  const status = computed<SessionStatus>(() => {
    if (cards.value.length === 0) return 'setup'
    return index.value >= cards.value.length ? 'finished' : 'active'
  })

  const current = computed<StudyCard | undefined>(() => cards.value[index.value])
  const knownCount = computed(() => Object.values(results.value).filter(Boolean).length)
  const unknownCards = computed(() => cards.value.filter((c) => results.value[c.key] === false))

  function toggleMode(id: QuizModeId): void {
    enabledModes.value = enabledModes.value.includes(id)
      ? enabledModes.value.filter((m) => m !== id)
      : [...enabledModes.value, id]
    saveJSON('study-modes', enabledModes.value)
  }

  function start(deck: StudyCard[]): void {
    cards.value = deck
    index.value = 0
    flipped.value = false
    results.value = {}
  }

  function flip(): void {
    if (status.value === 'active') flipped.value = !flipped.value
  }

  /** 翻面後才能作答 */
  function answer(known: boolean): void {
    const card = current.value
    if (!card || !flipped.value) return
    results.value = { ...results.value, [card.key]: known }
    index.value++
    flipped.value = false
  }

  function retryUnknown(): void {
    start(shuffle(unknownCards.value))
  }

  function reset(): void {
    start([])
  }

  return {
    cards,
    index,
    flipped,
    results,
    enabledModes,
    status,
    current,
    knownCount,
    unknownCards,
    toggleMode,
    start,
    flip,
    answer,
    retryUnknown,
    reset,
  }
})
