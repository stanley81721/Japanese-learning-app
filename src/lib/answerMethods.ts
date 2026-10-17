import type { Dataset } from '@/types/dataset'
import { buildCard, getQuizMode, isModeAvailable, type StudyCard } from './quizModes'
import { pickRandom, shuffle, type RandomFn } from './shuffle'

export type AnswerMethod = 'flip' | 'choice' | 'input'

export const ANSWER_METHODS: readonly { id: AnswerMethod; label: string }[] = [
  { id: 'flip', label: '翻卡自評' },
  { id: 'choice', label: '選擇題' },
  { id: 'input', label: '輸入作答' },
]

export const ANSWER_METHOD_IDS = ANSWER_METHODS.map((m) => m.id)

/** 學習佇列中的一題：卡片＋這次使用的作答方式 */
export interface SessionEntry {
  card: StudyCard
  method: AnswerMethod
  /** 選擇題的四個選項（已洗牌，其中一個是正解） */
  choices?: string[]
}

const DISTRACTORS = 3

/**
 * 從同分類的資料集中找 3 個干擾選項：用同一個測驗方向產生其他項目的答案，
 * 去掉重複與和正解相同的。不足 3 個時回傳 null（這題不出選擇題）。
 */
export function buildChoices(
  card: StudyCard,
  pool: readonly Dataset[],
  random: RandomFn = Math.random,
): string[] | null {
  const correct = card.back.text
  const category = getQuizMode(card.modeId).category
  const candidates = new Set<string>()
  for (const dataset of pool) {
    if (dataset.category !== category) continue
    for (const item of dataset.data) {
      if (dataset.id === card.datasetId && item.id === card.itemId) continue
      if (!isModeAvailable(card.modeId, item)) continue
      const text = buildCard(dataset, item, card.modeId, random).back.text
      if (text !== correct) candidates.add(text)
    }
  }
  if (candidates.size < DISTRACTORS) return null
  const distractors = shuffle([...candidates], random).slice(0, DISTRACTORS)
  return shuffle([correct, ...distractors], random)
}

/** 只有答案是日文的題目才出輸入題；中文答案的說法太多，無法可靠比對 */
export function canInput(card: StudyCard): boolean {
  return card.back.lang === 'ja' && Boolean(card.answers?.length)
}

/** 從啟用且適用於這張卡的作答方式中隨機挑一個；都不適用時用翻卡 */
export function assignAnswerMethod(
  card: StudyCard,
  enabled: readonly AnswerMethod[],
  pool: readonly Dataset[],
  random: RandomFn = Math.random,
): SessionEntry {
  const options: SessionEntry[] = []
  for (const method of enabled) {
    if (method === 'flip') options.push({ card, method })
    else if (method === 'input' && canInput(card)) options.push({ card, method })
    else if (method === 'choice') {
      const choices = buildChoices(card, pool, random)
      if (choices) options.push({ card, method, choices })
    }
  }
  return options.length ? pickRandom(options, random) : { card, method: 'flip' }
}

const KATAKANA = /[ァ-ヶ]/g

/**
 * 比對前的正規化：全形半形統一（NFKC）、去掉空白與常見標點、
 * 片假名轉平假名、英文轉小寫。
 */
export function normalizeAnswer(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[\s。、，,.・～〜~!?！？「」…＿_]/g, '')
    .replace(KATAKANA, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .toLowerCase()
}

export function isCorrectInput(input: string, answers: readonly string[]): boolean {
  const normalized = normalizeAnswer(input)
  return normalized !== '' && answers.some((a) => normalizeAnswer(a) === normalized)
}
