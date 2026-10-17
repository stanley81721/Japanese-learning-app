// 簡化版 SM-2 間隔重複演算法（類似 Anki）。全部是純函式，方便測試；未來可換成 FSRS。

export type Grade = 'again' | 'hard' | 'good' | 'easy'
export type CardState = 'new' | 'learning' | 'review' | 'relearning'

export const GRADES: readonly Grade[] = ['again', 'hard', 'good', 'easy']

export interface CardProgress {
  /** 資料集ID:項目ID:模式ID */
  key: string
  state: CardState
  /** 難易係數，預設 2.5，下限 1.3 */
  ease: number
  /** 複習間隔（天）；學習中的卡為 0 */
  interval: number
  /** 學習／重新學習步驟的索引 */
  step: number
  /** 下次到期時間（ms timestamp） */
  due: number
  reps: number
  lapses: number
  lastReviewed: number
}

const MINUTE = 60_000
export const DAY = 24 * 60 * MINUTE

/** 新卡的學習步驟（分鐘） */
export const LEARNING_STEPS = [1, 10]
/** 忘記後重新學習的步驟（分鐘） */
export const RELEARNING_STEPS = [10]
export const GRADUATING_INTERVAL = 1
export const EASY_INTERVAL = 4
export const DEFAULT_EASE = 2.5
export const MIN_EASE = 1.3
export const MAX_INTERVAL = 3650

export function newProgress(key: string, now: number): CardProgress {
  return {
    key,
    state: 'new',
    ease: DEFAULT_EASE,
    interval: 0,
    step: 0,
    due: now,
    reps: 0,
    lapses: 0,
    lastReviewed: 0,
  }
}

const clampInterval = (days: number) => Math.min(MAX_INTERVAL, Math.max(1, Math.round(days)))
const clampEase = (ease: number) => Math.max(MIN_EASE, Math.round(ease * 100) / 100)

/** 在學習步驟中前進；走完所有步驟就畢業成 review */
function stepThrough(
  p: CardProgress,
  grade: Grade,
  steps: readonly number[],
  graduateInterval: number,
  now: number,
): CardProgress {
  const graduate = (interval: number): CardProgress => ({
    ...p,
    state: 'review',
    step: 0,
    interval,
    due: now + interval * DAY,
  })
  const stayAt = (step: number): CardProgress => ({ ...p, step, due: now + steps[step]! * MINUTE })

  switch (grade) {
    case 'again':
      return stayAt(0)
    case 'hard':
      return stayAt(Math.min(p.step, steps.length - 1))
    case 'good':
      return p.step + 1 >= steps.length ? graduate(graduateInterval) : stayAt(p.step + 1)
    case 'easy':
      return graduate(
        Math.max(graduateInterval, p.state === 'relearning' ? p.interval + 1 : EASY_INTERVAL),
      )
  }
}

export function schedule(progress: CardProgress, grade: Grade, now: number): CardProgress {
  const p: CardProgress = { ...progress, reps: progress.reps + 1, lastReviewed: now }

  if (p.state === 'new' || p.state === 'learning') {
    return stepThrough({ ...p, state: 'learning' }, grade, LEARNING_STEPS, GRADUATING_INTERVAL, now)
  }

  if (p.state === 'relearning') {
    return stepThrough(p, grade, RELEARNING_STEPS, p.interval, now)
  }

  // review
  if (grade === 'again') {
    return {
      ...p,
      state: 'relearning',
      step: 0,
      lapses: p.lapses + 1,
      ease: clampEase(p.ease - 0.2),
      interval: 1,
      due: now + RELEARNING_STEPS[0]! * MINUTE,
    }
  }

  const factor = { hard: 1.2, good: p.ease, easy: p.ease * 1.3 }[grade]
  const easeDelta = { hard: -0.15, good: 0, easy: 0.15 }[grade]
  // 至少比原本多一天，避免間隔停滯
  const interval = clampInterval(Math.max(p.interval + 1, p.interval * factor))
  return { ...p, ease: clampEase(p.ease + easeDelta), interval, due: now + interval * DAY }
}

/** 學習中的卡要等到 due；複習卡只要今天內到期就算 */
export function isDue(p: CardProgress, now: number): boolean {
  if (p.state === 'review') return p.due <= endOfDay(now)
  return p.due <= now
}

/** 下一次是否仍在學習步驟中（本次學習中要再出現） */
export function isInLearning(p: CardProgress): boolean {
  return p.state === 'learning' || p.state === 'relearning'
}

export function endOfDay(now: number): number {
  const d = new Date(now)
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

/** 本地日期字串 YYYY-MM-DD，用於每日統計 */
export function dayKey(now: number): string {
  const d = new Date(now)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 評分按鈕上顯示的下次間隔，例如「10 分」「3 天」 */
export function formatInterval(ms: number): string {
  if (ms < 60 * MINUTE) return `${Math.max(1, Math.round(ms / MINUTE))} 分`
  if (ms < DAY) return `${Math.round(ms / (60 * MINUTE))} 小時`
  const days = Math.round(ms / DAY)
  if (days < 30) return `${days} 天`
  if (days < 365) return `${Math.round(days / 30)} 個月`
  return `${Math.round((days / 365) * 10) / 10} 年`
}

export function previewIntervals(progress: CardProgress, now: number): Record<Grade, string> {
  const result = {} as Record<Grade, string>
  for (const grade of GRADES)
    result[grade] = formatInterval(schedule(progress, grade, now).due - now)
  return result
}
