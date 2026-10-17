import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { buildStudyQueue, countDataset, requeuePosition } from '@/lib/queue'
import { DAY, newProgress, type CardProgress } from '@/lib/srs'
import { loadVersioned, saveVersioned } from '@/lib/storage'
import { useProgressStore } from '@/stores/progress'
import type { Dataset } from '@/types/dataset'

const NOW = new Date(2026, 9, 17, 10, 0).getTime()

const dataset: Dataset = {
  id: 'vocabulary/t',
  name: 'T',
  category: 'vocabulary',
  level: 'N5',
  data: ['a', 'b', 'c', 'd'].map((id) => ({ id, japanese: id, simple_chinese: id })),
}

function lookup(records: CardProgress[]) {
  const map = new Map(records.map((r) => [r.key, r]))
  return (key: string) => map.get(key)
}

const review = (key: string, due: number): CardProgress => ({
  ...newProgress(key, NOW),
  state: 'review',
  interval: 3,
  due,
})

describe('buildStudyQueue', () => {
  it('limits new cards and picks one unseen mode per item', () => {
    const queue = buildStudyQueue({
      datasets: [dataset],
      modeIds: ['vocab-kanji-to-zh', 'vocab-zh-to-jp'],
      progress: () => undefined,
      newLimit: 3,
      now: NOW,
    })
    expect(queue).toHaveLength(3)
    expect(new Set(queue.map((c) => c.itemId)).size).toBe(3)
  })

  it('includes due cards, skips future ones, and does not add a new mode for an item already due', () => {
    const progress = lookup([
      review('vocabulary/t:a:vocab-kanji-to-zh', NOW - DAY),
      review('vocabulary/t:b:vocab-kanji-to-zh', NOW + 5 * DAY),
    ])
    const queue = buildStudyQueue({
      datasets: [dataset],
      modeIds: ['vocab-kanji-to-zh', 'vocab-zh-to-jp'],
      progress,
      newLimit: 10,
      now: NOW,
    })
    const keys = queue.map((c) => c.key)
    expect(keys).toContain('vocabulary/t:a:vocab-kanji-to-zh')
    expect(keys.filter((k) => k.includes(':a:'))).toHaveLength(1)
    // b 的 kanji 方向還沒到期，但 zh-to-jp 方向還沒學過 → 當新卡
    expect(keys).toContain('vocabulary/t:b:vocab-zh-to-jp')
    expect(queue).toHaveLength(4)
  })

  it('returns no new cards when the daily limit is used up', () => {
    const queue = buildStudyQueue({
      datasets: [dataset],
      modeIds: ['vocab-kanji-to-zh'],
      progress: () => undefined,
      newLimit: 0,
      now: NOW,
    })
    expect(queue).toEqual([])
  })
})

describe('countDataset', () => {
  it('counts due cards and seen/unseen items for the enabled modes', () => {
    const progress = lookup([
      review('vocabulary/t:a:vocab-kanji-to-zh', NOW),
      review('vocabulary/t:a:vocab-zh-to-jp', NOW),
      review('vocabulary/t:b:vocab-zh-to-jp', NOW + 9 * DAY),
    ])
    expect(countDataset(dataset, ['vocab-kanji-to-zh', 'vocab-zh-to-jp'], progress, NOW)).toEqual({
      due: 2,
      seen: 2,
      unseen: 2,
    })
    expect(countDataset(dataset, ['vocab-kanji-to-zh'], progress, NOW)).toEqual({
      due: 1,
      seen: 1,
      unseen: 3,
    })
  })
})

describe('requeuePosition', () => {
  it('puts the card 3–5 cards later, but never past the end', () => {
    expect(requeuePosition(0, 20, () => 0)).toBe(4)
    expect(requeuePosition(0, 20, () => 0.99)).toBe(6)
    expect(requeuePosition(8, 10, () => 0)).toBe(10)
  })
})

describe('progress store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('records reviews, daily stats, and persists them', () => {
    const store = useProgressStore()
    store.review('x:1:m', 'good', NOW)
    store.review('x:1:m', 'again', NOW + 1000)
    store.review('x:2:m', 'easy', NOW + 2000)

    expect(store.get('x:1:m')).toMatchObject({ state: 'learning', reps: 2 })
    expect(store.statsFor(NOW)).toEqual({ reviews: 3, again: 1, newCards: 2 })

    setActivePinia(createPinia())
    const reloaded = useProgressStore()
    expect(reloaded.get('x:2:m')).toMatchObject({ state: 'review', interval: 4 })
    expect(reloaded.statsFor(NOW).reviews).toBe(3)
  })

  it('resets the progress of one dataset only', () => {
    const store = useProgressStore()
    store.review('vocabulary/a:1:m', 'good', NOW)
    store.review('vocabulary/ab:1:m', 'good', NOW)
    store.resetDataset('vocabulary/a')
    expect(Object.keys(store.cards)).toEqual(['vocabulary/ab:1:m'])
  })

  it('does not overwrite stored data it cannot read', () => {
    localStorage.setItem('jla:v1:progress', JSON.stringify({ version: 99, data: { keep: 1 } }))
    const store = useProgressStore()
    expect(store.readOnly).toBe(true)
    store.review('x:1:m', 'good', NOW)
    expect(JSON.parse(localStorage.getItem('jla:v1:progress')!)).toEqual({
      version: 99,
      data: { keep: 1 },
    })
  })
})

describe('versioned storage', () => {
  it('returns undefined when missing, data when current, and migrates older versions', () => {
    expect(loadVersioned('v', 2)).toBeUndefined()
    saveVersioned('v', 2, { a: 1 })
    expect(loadVersioned('v', 2)).toEqual({ a: 1 })
    saveVersioned('v', 1, { a: 1 })
    expect(loadVersioned('v', 2, (data) => ({ migrated: data }))).toEqual({ migrated: { a: 1 } })
  })

  it('returns null for unrecognised data', () => {
    localStorage.setItem('jla:v1:v', '"just a string"')
    expect(loadVersioned('v', 1)).toBeNull()
  })
})
