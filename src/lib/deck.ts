import type { Dataset } from '@/types/dataset'
import { buildCard, getQuizMode, type QuizModeId, type StudyCard } from './quizModes'
import { pickRandom, shuffle, type RandomFn } from './shuffle'

/**
 * 自由練習用的牌組：選取資料集中的每個項目出現一次，
 * 測驗方向從勾選的模式中隨機挑一個，最後整體洗牌。
 */
export function buildPracticeDeck(
  datasets: readonly Dataset[],
  modeIds: readonly QuizModeId[],
  random: RandomFn = Math.random,
): StudyCard[] {
  const cards: StudyCard[] = []
  for (const dataset of datasets) {
    const modes = modeIds.filter((id) => getQuizMode(id).category === dataset.category)
    if (modes.length === 0) continue
    for (const item of dataset.data) {
      cards.push(buildCard(dataset, item, pickRandom(modes, random)))
    }
  }
  return shuffle(cards, random)
}
