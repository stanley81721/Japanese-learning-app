import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { QUIZ_MODE_IDS, type QuizModeId, type StudyCard } from '@/lib/quizModes'
import { requeuePosition } from '@/lib/queue'
import { isInLearning, previewIntervals, type Grade } from '@/lib/srs'
import { loadJSON, saveJSON } from '@/lib/storage'
import { shuffle } from '@/lib/shuffle'
import { useProgressStore } from '@/stores/progress'

export type SessionStatus = 'setup' | 'active' | 'finished'
/** srs：依記憶演算法排程並記錄進度；practice：自由練習，不記錄 */
export type SessionMode = 'srs' | 'practice'

export const useStudySessionStore = defineStore('studySession', () => {
  const progress = useProgressStore()

  const mode = ref<SessionMode>('srs')
  /** 學習佇列；SRS 模式中答錯的卡會被插回後方 */
  const queue = ref<StudyCard[]>([])
  const index = ref(0)
  const flipped = ref(false)
  /** 每張卡第一次的評分（用於結果統計） */
  const firstGrades = ref<Record<string, Grade>>({})
  const reviewCount = ref(0)

  const savedModes = loadJSON<QuizModeId[]>('study-modes', [...QUIZ_MODE_IDS])
  const enabledModes = ref<QuizModeId[]>(savedModes.filter((id) => QUIZ_MODE_IDS.includes(id)))

  const status = computed<SessionStatus>(() => {
    if (queue.value.length === 0) return 'setup'
    return index.value >= queue.value.length ? 'finished' : 'active'
  })

  const current = computed<StudyCard | undefined>(() => queue.value[index.value])
  const remaining = computed(() => queue.value.length - index.value)

  const uniqueCards = computed(() => {
    const seen = new Map<string, StudyCard>()
    for (const card of queue.value) if (!seen.has(card.key)) seen.set(card.key, card)
    return [...seen.values()]
  })
  const studiedCount = computed(() => Object.keys(firstGrades.value).length)
  const unknownCards = computed(() =>
    uniqueCards.value.filter((c) => firstGrades.value[c.key] === 'again'),
  )
  const knownCount = computed(() => studiedCount.value - unknownCards.value.length)

  /** SRS 模式下各評分按鈕對應的下次間隔 */
  const intervalPreview = computed<Record<Grade, string> | null>(() => {
    const card = current.value
    if (mode.value !== 'srs' || !card) return null
    const now = Date.now()
    return previewIntervals(progress.getOrNew(card.key, now), now)
  })

  function toggleMode(id: QuizModeId): void {
    enabledModes.value = enabledModes.value.includes(id)
      ? enabledModes.value.filter((m) => m !== id)
      : [...enabledModes.value, id]
    saveJSON('study-modes', enabledModes.value)
  }

  function start(deck: StudyCard[], sessionMode: SessionMode): void {
    mode.value = sessionMode
    queue.value = deck
    index.value = 0
    flipped.value = false
    firstGrades.value = {}
    reviewCount.value = 0
  }

  function flip(): void {
    if (status.value === 'active') flipped.value = !flipped.value
  }

  /** 翻面後才能作答 */
  function answer(grade: Grade): void {
    const card = current.value
    if (!card || !flipped.value) return

    if (!(card.key in firstGrades.value)) {
      firstGrades.value = { ...firstGrades.value, [card.key]: grade }
    }
    reviewCount.value++

    if (mode.value === 'srs') {
      const updated = progress.review(card.key, grade, Date.now())
      if (isInLearning(updated)) {
        const next = [...queue.value]
        next.splice(requeuePosition(index.value, next.length), 0, card)
        queue.value = next
      }
    }

    index.value++
    flipped.value = false
  }

  function retryUnknown(): void {
    start(shuffle(unknownCards.value), 'practice')
  }

  function reset(): void {
    start([], mode.value)
  }

  return {
    mode,
    queue,
    index,
    flipped,
    firstGrades,
    reviewCount,
    enabledModes,
    status,
    current,
    remaining,
    studiedCount,
    knownCount,
    unknownCards,
    intervalPreview,
    toggleMode,
    start,
    flip,
    answer,
    retryUnknown,
    reset,
  }
})
