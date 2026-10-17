import type { Dataset } from '@/types/dataset'
import { buildCard, getQuizMode, type QuizModeId, type StudyCard } from './quizModes'
import { pickRandom, shuffle, type RandomFn } from './shuffle'
import { isDue, type CardProgress } from './srs'

type ProgressLookup = (key: string) => CardProgress | undefined

function modesFor(dataset: Dataset, modeIds: readonly QuizModeId[]): QuizModeId[] {
  return modeIds.filter((id) => getQuizMode(id).category === dataset.category)
}

const keyOf = (dataset: Dataset, itemId: string, modeId: QuizModeId) =>
  `${dataset.id}:${itemId}:${modeId}`

export interface QueueOptions {
  datasets: readonly Dataset[]
  modeIds: readonly QuizModeId[]
  progress: ProgressLookup
  /** 本次最多可加入幾張新卡（每日上限扣掉今天已學的） */
  newLimit: number
  now: number
  random?: RandomFn
}

/**
 * 建立 SRS 學習佇列：
 * 1. 所有到期的卡（每個項目的每個測驗方向各自計算）
 * 2. 新卡：依資料集順序取還沒學過的項目，每個項目只挑一個尚未學過的方向，最多 newLimit 張
 * 3. 兩者混合洗牌
 */
export function buildStudyQueue(options: QueueOptions): StudyCard[] {
  const { datasets, modeIds, progress, newLimit, now, random = Math.random } = options
  const due: StudyCard[] = []
  const fresh: StudyCard[] = []

  for (const dataset of datasets) {
    const modes = modesFor(dataset, modeIds)
    for (const item of dataset.data) {
      let hasDueCard = false
      const unseen: QuizModeId[] = []
      for (const modeId of modes) {
        const p = progress(keyOf(dataset, item.id, modeId))
        if (!p) unseen.push(modeId)
        else if (isDue(p, now)) {
          due.push(buildCard(dataset, item, modeId))
          hasDueCard = true
        }
      }
      // 同一個項目這次已經有複習卡時，就不再加它的新方向，避免連續出現
      if (!hasDueCard && unseen.length && fresh.length < newLimit) {
        fresh.push(buildCard(dataset, item, pickRandom(unseen, random)))
      }
    }
  }

  return shuffle([...due, ...fresh], random)
}

export interface DatasetCounts {
  /** 到期待複習的卡數 */
  due: number
  /** 還沒學過任何方向的項目數 */
  unseen: number
  /** 至少學過一個方向的項目數 */
  seen: number
}

export function countDataset(
  dataset: Dataset,
  modeIds: readonly QuizModeId[],
  progress: ProgressLookup,
  now: number,
): DatasetCounts {
  const modes = modesFor(dataset, modeIds)
  const counts: DatasetCounts = { due: 0, unseen: 0, seen: 0 }
  for (const item of dataset.data) {
    let seen = false
    for (const modeId of modes) {
      const p = progress(keyOf(dataset, item.id, modeId))
      if (!p) continue
      seen = true
      if (isDue(p, now)) counts.due++
    }
    if (seen) counts.seen++
    else counts.unseen++
  }
  return counts
}

/** 答「再一次」等仍在學習中的卡，插回佇列後方 3–5 張的位置 */
export function requeuePosition(
  currentIndex: number,
  queueLength: number,
  random: RandomFn = Math.random,
): number {
  const gap = 3 + Math.floor(random() * 3)
  return Math.min(queueLength, currentIndex + 1 + gap)
}
