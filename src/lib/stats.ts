import type { Dataset } from '@/types/dataset'
import { modesForItem, type QuizModeId } from './quizModes'
import { dayKey, type CardProgress } from './srs'

export interface DayStatsLike {
  reviews: number
  again: number
  newCards: number
}

export interface DayPoint extends DayStatsLike {
  /** YYYY-MM-DD */
  day: string
  /** 顯示用 M/D */
  label: string
  /** 正確率 0–1；當天沒作答為 null */
  accuracy: number | null
}

const EMPTY: DayStatsLike = { reviews: 0, again: 0, newCards: 0 }

export function accuracyOf(s: DayStatsLike): number | null {
  return s.reviews > 0 ? (s.reviews - s.again) / s.reviews : null
}

/** 最近 days 天（含今天）的每日作答，舊到新排列 */
export function dailySeries(
  history: Record<string, DayStatsLike>,
  now: number,
  days = 30,
): DayPoint[] {
  const today = new Date(now)
  const points: DayPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    const key = dayKey(d.getTime())
    const stats = history[key] ?? EMPTY
    points.push({
      ...stats,
      day: key,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      accuracy: accuracyOf(stats),
    })
  }
  return points
}

/** 連續學習天數；今天還沒學時從昨天往回算 */
export function streak(history: Record<string, DayStatsLike>, now: number): number {
  const today = new Date(now)
  const studied = (offset: number) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset)
    return (history[dayKey(d.getTime())]?.reviews ?? 0) > 0
  }
  let offset = studied(0) ? 0 : 1
  let count = 0
  while (studied(offset)) {
    count++
    offset++
  }
  return count
}

/** 複習間隔達到這個天數視為「已熟記」 */
export const MATURE_INTERVAL = 21

export interface Maturity {
  /** 還沒學過 */
  unseen: number
  /** 學習中（含忘記後重新學習） */
  learning: number
  /** 複習中，間隔未滿 21 天 */
  young: number
  /** 複習間隔 21 天以上 */
  mature: number
}

export const MATURITY_LABELS: Record<keyof Maturity, string> = {
  unseen: '未學',
  learning: '學習中',
  young: '複習中',
  mature: '已熟記',
}

/** 依勾選的測驗方向，統計一份資料集所有卡片的熟練度 */
export function maturityFor(
  dataset: Dataset,
  modeIds: readonly QuizModeId[],
  cards: Record<string, CardProgress>,
): Maturity {
  const result: Maturity = { unseen: 0, learning: 0, young: 0, mature: 0 }
  for (const item of dataset.data) {
    for (const modeId of modesForItem(dataset, item, modeIds)) {
      const p = cards[`${dataset.id}:${item.id}:${modeId}`]
      if (!p || p.state === 'new') result.unseen++
      else if (p.state === 'learning' || p.state === 'relearning') result.learning++
      else if (p.interval >= MATURE_INTERVAL) result.mature++
      else result.young++
    }
  }
  return result
}

/** 座標軸用的整齊上限與刻度，例如最大值 37 → 0 / 20 / 40 */
export function niceTicks(max: number, count = 3): number[] {
  if (max <= 0) return [0, 1]
  const rough = max / (count - 1)
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= rough)!
  const ticks: number[] = []
  for (let v = 0; v < max + step; v += step) ticks.push(v)
  return ticks
}
