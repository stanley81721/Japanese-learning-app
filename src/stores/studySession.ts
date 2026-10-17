import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import {
  assignAnswerMethod,
  isCorrectInput,
  type AnswerMethod,
  type SessionEntry,
} from '@/lib/answerMethods'
import { QUIZ_MODE_IDS, type QuizModeId, type StudyCard } from '@/lib/quizModes'
import { requeuePosition } from '@/lib/queue'
import { isInLearning, previewIntervals, type Grade } from '@/lib/srs'
import { loadJSON, saveJSON } from '@/lib/storage'
import { shuffle } from '@/lib/shuffle'
import { useProgressStore } from '@/stores/progress'
import type { Dataset } from '@/types/dataset'

export type SessionStatus = 'setup' | 'active' | 'finished'
/** srs：依記憶演算法排程並記錄進度；practice：自由練習或測驗，不記錄 */
export type SessionMode = 'srs' | 'practice'

/** 選擇題或輸入題作答後的結果；翻面並等使用者按「繼續」才正式評分 */
export interface SessionResponse {
  correct: boolean
  /** 選擇題選了第幾個 */
  choice?: number
  /** 輸入題輸入的內容 */
  input?: string
  /** 輸入題被判錯，使用者改判為正確 */
  overridden?: boolean
}

export interface StartOptions {
  mode: SessionMode
  /** 啟用的作答方式 */
  methods?: readonly AnswerMethod[]
  /** 選擇題干擾選項的來源 */
  pool?: readonly Dataset[]
}

/** M5 之前存的是「開啟的」方向清單，當時只有這五種 */
const LEGACY_MODE_IDS: readonly QuizModeId[] = [
  'vocab-kanji-to-zh',
  'vocab-kana-to-zh',
  'vocab-zh-to-jp',
  'grammar-pattern-to-zh',
  'grammar-zh-to-pattern',
]

function loadDisabledModes(modesKey: string): QuizModeId[] {
  const disabled = loadJSON<QuizModeId[] | null>(`${modesKey}-disabled`, null)
  if (Array.isArray(disabled)) return disabled.filter((m) => QUIZ_MODE_IDS.includes(m))
  const legacyEnabled = loadJSON<QuizModeId[] | null>(modesKey, null)
  if (Array.isArray(legacyEnabled)) return LEGACY_MODE_IDS.filter((m) => !legacyEnabled.includes(m))
  return []
}

/** 學習與測驗各用一個獨立的 store，互不干擾 */
function defineSessionStore(id: string, modesKey: string) {
  return defineStore(id, () => {
    const progress = useProgressStore()

    const mode = ref<SessionMode>('srs')
    const methods = ref<readonly AnswerMethod[]>(['flip'])
    let pool: readonly Dataset[] = []

    /** 學習佇列；SRS 模式中答錯的卡會被插回後方 */
    const queue = ref<SessionEntry[]>([])
    const index = ref(0)
    const flipped = ref(false)
    const response = ref<SessionResponse | null>(null)
    /** 每張卡第一次的評分（用於結果統計） */
    const firstGrades = ref<Record<string, Grade>>({})
    const reviewCount = ref(0)

    // 存「關閉的」方向，之後新增的測驗方向預設就會開啟
    const disabledModes = ref<QuizModeId[]>(loadDisabledModes(modesKey))
    const enabledModes = computed<QuizModeId[]>(() =>
      QUIZ_MODE_IDS.filter((m) => !disabledModes.value.includes(m)),
    )

    const status = computed<SessionStatus>(() => {
      if (queue.value.length === 0) return 'setup'
      return index.value >= queue.value.length ? 'finished' : 'active'
    })

    const currentEntry = computed<SessionEntry | undefined>(() => queue.value[index.value])
    const current = computed<StudyCard | undefined>(() => currentEntry.value?.card)
    const remaining = computed(() => queue.value.length - index.value)

    const uniqueCards = computed(() => {
      const seen = new Map<string, StudyCard>()
      for (const { card } of queue.value) if (!seen.has(card.key)) seen.set(card.key, card)
      return [...seen.values()]
    })
    const studiedCount = computed(() => Object.keys(firstGrades.value).length)
    const unknownCards = computed(() =>
      uniqueCards.value.filter((c) => firstGrades.value[c.key] === 'again'),
    )
    const knownCount = computed(() => studiedCount.value - unknownCards.value.length)

    /** SRS 模式翻卡自評時，各評分按鈕對應的下次間隔 */
    const intervalPreview = computed<Record<Grade, string> | null>(() => {
      const card = current.value
      if (mode.value !== 'srs' || !card) return null
      const now = Date.now()
      return previewIntervals(progress.getOrNew(card.key, now), now)
    })

    function toggleMode(modeId: QuizModeId): void {
      disabledModes.value = disabledModes.value.includes(modeId)
        ? disabledModes.value.filter((m) => m !== modeId)
        : [...disabledModes.value, modeId]
      saveJSON(`${modesKey}-disabled`, disabledModes.value)
    }

    function entryFor(card: StudyCard): SessionEntry {
      return assignAnswerMethod(card, methods.value, pool)
    }

    function start(deck: StudyCard[], options: StartOptions): void {
      mode.value = options.mode
      methods.value = options.methods?.length ? options.methods : ['flip']
      pool = options.pool ?? []
      queue.value = deck.map(entryFor)
      index.value = 0
      flipped.value = false
      response.value = null
      firstGrades.value = {}
      reviewCount.value = 0
    }

    /** 只有翻卡自評可以直接翻面；其他方式作答後自動翻面 */
    function flip(): void {
      if (status.value === 'active' && currentEntry.value?.method === 'flip') {
        flipped.value = !flipped.value
      }
    }

    function submitChoice(choice: number): void {
      const entry = currentEntry.value
      if (!entry?.choices || response.value) return
      response.value = { choice, correct: entry.choices[choice] === entry.card.back.text }
      flipped.value = true
    }

    function submitInput(input: string): void {
      const entry = currentEntry.value
      if (entry?.method !== 'input' || response.value || !input.trim()) return
      response.value = { input, correct: isCorrectInput(input, entry.card.answers ?? []) }
      flipped.value = true
    }

    /** 輸入題被判錯時，使用者可以改判為正確（例如同義寫法） */
    function overrideCorrect(): void {
      if (response.value && !response.value.correct && response.value.input !== undefined) {
        response.value = { ...response.value, correct: true, overridden: true }
      }
    }

    /** 選擇題、輸入題作答後按「繼續」：答對＝良好，答錯＝再一次 */
    function proceed(): void {
      if (response.value) answer(response.value.correct ? 'good' : 'again')
    }

    /** 翻面後才能評分 */
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
          // 再出現時重新隨機作答方式
          const next = [...queue.value]
          next.splice(requeuePosition(index.value, next.length), 0, entryFor(card))
          queue.value = next
        }
      }

      index.value++
      flipped.value = false
      response.value = null
    }

    function retryUnknown(): void {
      start(shuffle(unknownCards.value), { mode: 'practice', methods: methods.value, pool })
    }

    function reset(): void {
      queue.value = []
      index.value = 0
      flipped.value = false
      response.value = null
    }

    return {
      mode,
      queue,
      index,
      flipped,
      response,
      firstGrades,
      reviewCount,
      enabledModes,
      status,
      currentEntry,
      current,
      remaining,
      studiedCount,
      knownCount,
      unknownCards,
      intervalPreview,
      toggleMode,
      start,
      flip,
      submitChoice,
      submitInput,
      overrideCorrect,
      proceed,
      answer,
      retryUnknown,
      reset,
    }
  })
}

export const useStudySessionStore = defineSessionStore('studySession', 'study-modes')
export const useQuizSessionStore = defineSessionStore('quizSession', 'quiz-modes')

export type SessionStore = ReturnType<typeof useStudySessionStore>
