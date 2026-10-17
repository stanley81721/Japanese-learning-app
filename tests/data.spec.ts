// 檢查 data/ 中正式資料集的內容品質（格式本身由 validateDataset 檢查）。
// 其他測試用的是 tests/fixtures 的範例資料（見 tests/setup.ts），這裡要讀真正的 data/。
import { describe, expect, it, vi } from 'vitest'

import { checkGrammarMarkup, validateDataset } from '@/lib/validateDataset'
import type { GrammarItem, VocabularyItem } from '@/types/dataset'

const { loadDatasets } = await vi.importActual<typeof import('@/data/loader')>('@/data/loader')
const { datasets, errors } = await loadDatasets()
const bySeries = (series: string) => datasets.filter((d) => d.series === series)
const VOCAB_SERIES = 'N3 單字（tanos 清單）'

describe('data/ datasets', () => {
  it('all load without errors and none are samples', () => {
    expect(errors).toEqual([])
    expect(datasets.length).toBeGreaterThan(0)
    expect(datasets.filter((d) => d.series?.includes('範例'))).toEqual([])
  })

  it('item ids are unique across all datasets', () => {
    const ids = datasets.flatMap((d) => d.data.map((i) => i.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every dataset in a series shares category, level, and source', () => {
    for (const name of new Set(datasets.map((d) => d.series).filter(Boolean))) {
      const group = bySeries(name!)
      expect(new Set(group.map((d) => `${d.category}/${d.level}/${d.source ?? ''}`)).size).toBe(1)
    }
  })
})

describe('N3 tanos vocabulary', () => {
  const files = bySeries(VOCAB_SERIES)
  const words = files.flatMap((d) => d.data as VocabularyItem[])

  it('has all 1806 words in 19 evenly sized files with a source note', () => {
    expect(words).toHaveLength(1806)
    expect(files).toHaveLength(19)
    for (const d of files) {
      expect([95, 96]).toContain(d.data.length)
      expect(d.source).toContain('CC BY')
    }
  })

  it('is shuffled rather than in kana order', () => {
    const ids = files[0]!.data.map((w) => w.id)
    expect(ids).not.toEqual([...ids].sort())
    // 每個檔案都混有清單前段與後段的單字
    for (const d of files) {
      const numbers = d.data.map((w) => Number(w.id.slice(-4)))
      expect(Math.min(...numbers)).toBeLessThan(300)
      expect(Math.max(...numbers)).toBeGreaterThan(1500)
    }
  })

  it('every word has a kana reading (unless written in kana), usage, and an example with translation', () => {
    for (const w of words) {
      if (w.hiragana !== undefined) {
        expect(w.hiragana, w.id).toMatch(/^[぀-ヿー]+$/)
        expect(w.hiragana, w.id).not.toBe(w.japanese)
      } else {
        expect(w.japanese, w.id).toMatch(/^[぀-ヿー]+$/)
      }
      expect(w.full_explanation, w.id).toMatch(/^\*\*用法\*\*：.+\n\n\*\*例句\*\*：.+\n\n（.+）$/)
    }
  })
})

describe('N3 grammar', () => {
  const items = bySeries('N3 文法').flatMap((d) => d.data as GrammarItem[])

  it('every grammar point has an explanation and two translated, marked examples', () => {
    expect(items.length).toBeGreaterThanOrEqual(30)
    for (const g of items) {
      expect(g.full_explanation, g.id).toContain('**接續**')
      expect(g.examples, g.id).toHaveLength(2)
      for (const ex of g.examples!) {
        expect(checkGrammarMarkup(ex.sentence), `${g.id}: ${ex.sentence}`).toBeNull()
        expect(ex.translation, g.id).toBeTruthy()
      }
    }
  })

  it('does not repeat a grammar pattern', () => {
    const patterns = items.map((g) => g.japanese)
    expect(new Set(patterns).size).toBe(patterns.length)
  })
})

describe('validator: dataset-level optional fields', () => {
  const base = { name: 'x', category: 'vocabulary', level: 'N3', data: [] }

  it('accepts series and source strings', () => {
    expect(validateDataset({ ...base, series: 'S', source: 'src' }).ok).toBe(true)
  })

  it('rejects empty or non-string series and source', () => {
    expect(validateDataset({ ...base, series: '', source: 3 }).errors).toEqual([
      'series 必須是非空字串',
      'source 必須是非空字串',
    ])
  })
})
