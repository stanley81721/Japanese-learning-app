import { describe, expect, it } from 'vitest'

import {
  DAY,
  dayKey,
  formatInterval,
  isDue,
  newProgress,
  previewIntervals,
  schedule,
  type CardProgress,
  type Grade,
} from '@/lib/srs'

const MIN = 60_000
const NOW = new Date(2026, 9, 17, 10, 0, 0).getTime()

function run(grades: Grade[], start: CardProgress = newProgress('k', NOW)) {
  let p = start
  let t = NOW
  for (const g of grades) {
    p = schedule(p, g, t)
    t = Math.max(t, p.due)
  }
  return p
}

function reviewCard(interval: number, ease = 2.5): CardProgress {
  return { ...newProgress('k', NOW), state: 'review', interval, ease, due: NOW, reps: 3 }
}

describe('schedule: new and learning cards', () => {
  it('again restarts the first learning step (1 min)', () => {
    const p = schedule(newProgress('k', NOW), 'again', NOW)
    expect(p).toMatchObject({ state: 'learning', step: 0, due: NOW + MIN, reps: 1 })
  })

  it('good walks through 1 → 10 min, then graduates to a 1-day review', () => {
    const first = schedule(newProgress('k', NOW), 'good', NOW)
    expect(first).toMatchObject({ state: 'learning', step: 1, due: NOW + 10 * MIN })
    const second = schedule(first, 'good', NOW)
    expect(second).toMatchObject({ state: 'review', interval: 1, due: NOW + DAY })
  })

  it('hard repeats the current step', () => {
    const p = run(['good', 'hard'])
    expect(p).toMatchObject({ state: 'learning', step: 1 })
  })

  it('easy graduates immediately with a 4-day interval', () => {
    expect(schedule(newProgress('k', NOW), 'easy', NOW)).toMatchObject({
      state: 'review',
      interval: 4,
      due: NOW + 4 * DAY,
    })
  })

  it('does not change ease while learning', () => {
    expect(run(['again', 'hard', 'good', 'good']).ease).toBe(2.5)
  })
})

describe('schedule: review cards', () => {
  it.each([
    ['hard', 12, 2.35],
    ['good', 25, 2.5],
    ['easy', 33, 2.65],
  ] as const)('%s on a 10-day card → %i days, ease %f', (grade, interval, ease) => {
    const p = schedule(reviewCard(10), grade, NOW)
    expect(p).toMatchObject({ state: 'review', interval, ease, due: NOW + interval * DAY })
  })

  it('always grows the interval by at least one day', () => {
    expect(schedule(reviewCard(1, 1.3), 'hard', NOW).interval).toBe(2)
  })

  it('again lapses into relearning, lowers ease, and resets the interval', () => {
    const p = schedule(reviewCard(20), 'again', NOW)
    expect(p).toMatchObject({
      state: 'relearning',
      step: 0,
      lapses: 1,
      ease: 2.3,
      interval: 1,
      due: NOW + 10 * MIN,
    })
    const relearned = schedule(p, 'good', NOW)
    expect(relearned).toMatchObject({ state: 'review', interval: 1, due: NOW + DAY })
  })

  it('never lets ease drop below 1.3', () => {
    let p = reviewCard(10, 1.4)
    for (let i = 0; i < 5; i++) p = schedule({ ...p, state: 'review' }, 'again', NOW)
    expect(p.ease).toBe(1.3)
  })

  it('caps the interval at 10 years', () => {
    expect(schedule(reviewCard(3000, 3), 'easy', NOW).interval).toBe(3650)
  })
})

describe('isDue', () => {
  it('learning cards are due only once their time has passed', () => {
    const p = schedule(newProgress('k', NOW), 'good', NOW)
    expect(isDue(p, NOW)).toBe(false)
    expect(isDue(p, NOW + 10 * MIN)).toBe(true)
  })

  it('review cards count as due anywhere on their due day', () => {
    const p = { ...reviewCard(1), due: new Date(2026, 9, 18, 20, 0).getTime() }
    expect(isDue(p, new Date(2026, 9, 17, 23, 0).getTime())).toBe(false)
    expect(isDue(p, new Date(2026, 9, 18, 0, 5).getTime())).toBe(true)
  })
})

describe('formatting', () => {
  it('formats intervals for the grade buttons', () => {
    expect(formatInterval(30_000)).toBe('1 分')
    expect(formatInterval(10 * MIN)).toBe('10 分')
    expect(formatInterval(3 * 60 * MIN)).toBe('3 小時')
    expect(formatInterval(4 * DAY)).toBe('4 天')
    expect(formatInterval(90 * DAY)).toBe('3 個月')
    expect(formatInterval(730 * DAY)).toBe('2 年')
  })

  it('previews each grade for a new card', () => {
    expect(previewIntervals(newProgress('k', NOW), NOW)).toEqual({
      again: '1 分',
      hard: '1 分',
      good: '10 分',
      easy: '4 天',
    })
  })

  it('uses the local date for day keys', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59).getTime())).toBe('2026-01-05')
  })
})
