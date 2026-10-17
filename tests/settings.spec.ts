import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import App from '@/App.vue'
import { BACKUP_FORMAT, backupFileName, createBackup, parseBackup } from '@/lib/backup'
import { newProgress, schedule } from '@/lib/srs'
import { MATURE_INTERVAL, dailySeries, maturityFor, niceTicks, streak } from '@/lib/stats'
import { routes } from '@/router'
import { useDatasetsStore } from '@/stores/datasets'
import { useProgressStore } from '@/stores/progress'
import { sanitizeSettings, useSettingsStore } from '@/stores/settings'
import type { Dataset } from '@/types/dataset'

const NOW = new Date(2026, 9, 17, 12, 0).getTime()

describe('backup', () => {
  const card = schedule(newProgress('vocabulary/a:1:vocab-kanji-to-zh', NOW), 'good', NOW)
  const cards = { [card.key]: card }
  const history = { '2026-10-17': { reviews: 1, again: 0, newCards: 1 } }

  it('round-trips through JSON', () => {
    const backup = createBackup(cards, history, { theme: 'dark' }, new Date(NOW))
    const parsed = parseBackup(JSON.stringify(backup))
    expect(parsed).toEqual({ ok: true, backup })
  })

  it.each([
    ['not json', '{', '不是有效的 JSON'],
    ['another app', JSON.stringify({ format: 'x' }), '不是本 App'],
    [
      'a newer version',
      JSON.stringify({ format: BACKUP_FORMAT, version: 99, cards: {}, history: {} }),
      '版本比目前的 App 新',
    ],
    ['missing data', JSON.stringify({ format: BACKUP_FORMAT, version: 1 }), '缺少學習進度'],
    [
      'a broken card',
      JSON.stringify({
        format: BACKUP_FORMAT,
        version: 1,
        cards: { k: { ...card, key: 'k', state: 'bogus' } },
        history: {},
      }),
      '卡片進度格式錯誤：k',
    ],
    [
      'a key mismatch',
      JSON.stringify({ format: BACKUP_FORMAT, version: 1, cards: { other: card }, history: {} }),
      '卡片進度格式錯誤：other',
    ],
    [
      'bad history',
      JSON.stringify({
        format: BACKUP_FORMAT,
        version: 1,
        cards: {},
        history: { yesterday: { reviews: 1, again: 0, newCards: 0 } },
      }),
      '每日統計格式錯誤：yesterday',
    ],
  ])('rejects %s', (_name, text, error) => {
    const result = parseBackup(text)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain(error)
  })

  it('names the file by date', () => {
    expect(backupFileName(new Date(NOW))).toBe('japanese-learning-backup-2026-10-17.json')
  })
})

describe('progress store: replace and reset', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('replaces everything and clears read-only mode', () => {
    localStorage.setItem('jla:v1:progress', '"broken"')
    const store = useProgressStore()
    expect(store.readOnly).toBe(true)

    const card = newProgress('x:1:m', NOW)
    store.replaceAll({ [card.key]: card }, { '2026-10-17': { reviews: 2, again: 1, newCards: 0 } })
    expect(store.readOnly).toBe(false)

    setActivePinia(createPinia())
    expect(useProgressStore().totalCards).toBe(1)
    useProgressStore().resetAll()
    setActivePinia(createPinia())
    expect(useProgressStore().totalCards).toBe(0)
    expect(useProgressStore().statsFor(NOW).reviews).toBe(0)
  })
})

describe('settings', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('sanitizes saved or imported values', () => {
    expect(
      sanitizeSettings({ newCardsPerDay: 5, answerMethods: ['input', 'x'], theme: 'dark' }),
    ).toEqual({
      newCardsPerDay: 5,
      answerMethods: ['input'],
      theme: 'dark',
    })
    expect(sanitizeSettings('nope')).toEqual({
      newCardsPerDay: 20,
      answerMethods: ['flip', 'choice', 'input'],
      theme: 'system',
    })
  })

  it('restores settings and persists them', async () => {
    useSettingsStore().restore({ newCardsPerDay: 7, theme: 'light' })
    await flushPromises()
    setActivePinia(createPinia())
    expect(useSettingsStore().snapshot()).toEqual({
      newCardsPerDay: 7,
      answerMethods: ['flip', 'choice', 'input'],
      theme: 'light',
    })
  })
})

describe('stats', () => {
  const day = (offset: number) => {
    const d = new Date(NOW)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset)
  }
  const key = (offset: number) => {
    const d = day(offset)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  it('builds a daily series ending today', () => {
    const series = dailySeries({ [key(0)]: { reviews: 4, again: 1, newCards: 2 } }, NOW, 7)
    expect(series).toHaveLength(7)
    expect(series.at(-1)).toMatchObject({
      day: '2026-10-17',
      label: '10/17',
      reviews: 4,
      accuracy: 0.75,
    })
    expect(series[0]).toMatchObject({ day: '2026-10-11', reviews: 0, accuracy: null })
  })

  it('counts the streak from today, or from yesterday if today is empty', () => {
    const h = (offsets: number[]) =>
      Object.fromEntries(offsets.map((o) => [key(o), { reviews: 1, again: 0, newCards: 0 }]))
    expect(streak(h([0, 1, 2, 4]), NOW)).toBe(3)
    expect(streak(h([1, 2]), NOW)).toBe(2)
    expect(streak(h([2, 3]), NOW)).toBe(0)
  })

  it('classifies cards by maturity for the enabled modes', () => {
    const dataset: Dataset = {
      id: 'vocabulary/t',
      name: 'T',
      category: 'vocabulary',
      level: 'N5',
      data: ['a', 'b', 'c'].map((id) => ({ id, japanese: id, simple_chinese: id })),
    }
    const mk = (item: string, state: 'learning' | 'review', interval = 0) => ({
      ...newProgress(`vocabulary/t:${item}:vocab-kanji-to-zh`, NOW),
      state,
      interval,
    })
    const cards = Object.fromEntries(
      [mk('a', 'learning'), mk('b', 'review', 3), mk('c', 'review', MATURE_INTERVAL)].map((c) => [
        c.key,
        c,
      ]),
    )
    expect(maturityFor(dataset, ['vocab-kanji-to-zh'], cards)).toEqual({
      unseen: 0,
      learning: 1,
      young: 1,
      mature: 1,
    })
    expect(maturityFor(dataset, ['vocab-kanji-to-zh', 'vocab-zh-to-jp'], cards).unseen).toBe(3)
  })

  it('picks clean axis ticks', () => {
    expect(niceTicks(37)).toEqual([0, 20, 40])
    expect(niceTicks(20)).toEqual([0, 10, 20])
    expect(niceTicks(3)).toEqual([0, 2, 4])
    expect(niceTicks(0)).toEqual([0, 1])
  })
})

describe('views', () => {
  let wrapper: VueWrapper
  let pinia: Pinia

  async function mountAt(path: string) {
    const router = createRouter({ history: createMemoryHistory(), routes })
    router.push(path)
    await router.isReady()
    pinia = createPinia()
    wrapper = mount(App, { global: { plugins: [pinia, router] }, attachTo: document.body })
    await useDatasetsStore(pinia).ensureLoaded()
    await flushPromises()
  }

  const button = (text: string) => wrapper.findAll('button').find((b) => b.text().includes(text))!

  /** 模擬選擇檔案；jsdom 的 File 沒有 text()，這裡補上 */
  async function selectFile(content: string) {
    const input = wrapper.find('input[type="file"]')
    const file = new File([content], 'backup.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', { value: async () => content })
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    await flushPromises()
  }

  beforeEach(() => wrapper?.unmount())
  afterEach(() => {
    vi.restoreAllMocks()
    delete document.documentElement.dataset.theme
  })

  it('applies the theme to the document', async () => {
    await mountAt('/settings')
    await wrapper.find('input[value="dark"]').setValue(true)
    expect(document.documentElement.dataset.theme).toBe('dark')
    await wrapper.find('input[value="system"]').setValue(true)
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })

  it('imports a backup after confirmation', async () => {
    await mountAt('/settings')
    const card = newProgress('vocabulary/n3-business-sample:n3-biz-001:vocab-kanji-to-zh', NOW)
    const backup = createBackup(
      { [card.key]: { ...card, state: 'review', interval: 30 } },
      {},
      {
        newCardsPerDay: 9,
      },
    )
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)

    await selectFile(JSON.stringify(backup))

    expect(confirm).toHaveBeenCalled()
    expect(wrapper.find('.message').text()).toContain('已匯入 1 張卡')
    expect(useProgressStore(pinia).totalCards).toBe(1)
    expect(useSettingsStore(pinia).newCardsPerDay).toBe(9)
    expect(wrapper.text()).toContain('N3 商業單字（範例）（1 張卡）')

    // 清除單一資料集
    await button('清除進度').trigger('click')
    expect(useProgressStore(pinia).totalCards).toBe(0)
  })

  it('shows an error for an invalid backup and keeps the progress', async () => {
    await mountAt('/settings')
    useProgressStore(pinia).review('x:1:m', 'good', NOW)
    await selectFile('{"format":"nope"}')
    expect(wrapper.find('.message.error').text()).toContain('不是本 App')
    expect(useProgressStore(pinia).totalCards).toBe(1)
  })

  it('does not reset everything when the confirmation is cancelled', async () => {
    await mountAt('/settings')
    useProgressStore(pinia).review('x:1:m', 'good', NOW)
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    await button('清除所有進度').trigger('click')
    expect(useProgressStore(pinia).totalCards).toBe(1)
  })

  it('renders stats with tiles, the daily chart, and maturity rows', async () => {
    await mountAt('/stats')
    expect(wrapper.text()).toContain('還沒有學習紀錄')

    const progress = useProgressStore(pinia)
    progress.review('vocabulary/n4-daily-sample:n4-daily-001:vocab-kanji-to-zh', 'easy', Date.now())
    progress.review(
      'vocabulary/n4-daily-sample:n4-daily-002:vocab-kanji-to-zh',
      'again',
      Date.now(),
    )
    await flushPromises()

    const tiles = wrapper.findAll('.tile-value').map((t) => t.text())
    expect(tiles).toEqual(['2', '50%', '1天', '2'])
    expect(wrapper.findAll('.column')).toHaveLength(1)

    await wrapper.find('.slot:last-child').trigger('mouseenter')
    expect(wrapper.find('.tooltip').text()).toContain('作答 2 次')
    // 兩張圖各自有提示框，滑過一張時另一張不應出現
    expect(wrapper.findAll('.tooltip')).toHaveLength(1)
    await wrapper.find('.segment').trigger('mouseenter')
    expect(wrapper.findAll('.tooltip')).toHaveLength(1)
    expect(wrapper.find('.maturity .tooltip').exists()).toBe(true)

    const row = wrapper.findAll('.maturity-row').find((r) => r.text().includes('N4 日常單字'))!
    expect(row.findAll('.segment').map((s) => s.classes()[1])).toEqual([
      'unseen',
      'learning',
      'young',
    ])
  })
})
