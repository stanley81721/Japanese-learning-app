import type { Dataset } from '@/types/dataset'
import { buildCard, modesForItem, type QuizModeId, type StudyCard } from './quizModes'
import { pickRandom, shuffle, type RandomFn } from './shuffle'

/**
 * 自由練習用的牌組：選取資料集中的每個項目出現一次，
 * 測驗方向從勾選且適用的模式中隨機挑一個，最後整體洗牌。
 * 沒有任何適用模式的項目（例如只勾例句模式但沒有例句）會被略過。
 */
export function buildPracticeDeck(
  datasets: readonly Dataset[],
  modeIds: readonly QuizModeId[],
  random: RandomFn = Math.random,
): StudyCard[] {
  const cards: StudyCard[] = []
  for (const dataset of datasets) {
    for (const item of dataset.data) {
      const modes = modesForItem(dataset, item, modeIds)
      if (modes.length) cards.push(buildCard(dataset, item, pickRandom(modes, random), random))
    }
  }
  return shuffle(cards, random)
}

/** 自由練習／測驗可出的題數 */
export function countPracticeItems(
  datasets: readonly Dataset[],
  modeIds: readonly QuizModeId[],
): number {
  let count = 0
  for (const dataset of datasets) {
    for (const item of dataset.data) if (modesForItem(dataset, item, modeIds).length) count++
  }
  return count
}
