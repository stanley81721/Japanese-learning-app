// 檢查 data/ 中實際資料集的內容品質（格式本身由 validateDataset 檢查）
import { describe, expect, it } from 'vitest'

import { loadDatasets } from '@/data/loader'
import { checkGrammarMarkup, validateDataset } from '@/lib/validateDataset'
import type { GrammarItem, VocabularyItem } from '@/types/dataset'

const { datasets, errors } = await loadDatasets()
const bySeries = (series: string) => datasets.filter((d) => d.series === series)

describe('data/ datasets', () => {
  it('all load without errors', () => {
    expect(errors).toEqual([])
  })

  it('item ids are unique across all datasets', () => {
    const ids = datasets.flatMap((d) => d.data.map((i) => i.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every dataset in a real series shares category, level, and source', () => {
    // 「範例」刻意混合不同分類與等級，不列入檢查
    const series = new Set(datasets.map((d) => d.series).filter((s) => s && s !== '範例'))
    for (const name of series) {
      const group = bySeries(name!)
      expect(new Set(group.map((d) => `${d.category}/${d.level}/${d.source ?? ''}`)).size).toBe(1)
    }
  })
})

describe('N3 tanos vocabulary', () => {
  const words = bySeries('N3 單字（tanos 清單）').flatMap((d) => d.data as VocabularyItem[])

  it('has 200 words with a source note', () => {
    expect(words).toHaveLength(200)
    for (const d of bySeries('N3 單字（tanos 清單）')) expect(d.source).toContain('CC BY')
  })

  it('every word has a reading (unless written in kana), usage, and an example with translation', () => {
    for (const w of words) {
      const kanaOnly = /^[぀-ヿ・ー]+$/.test(w.japanese)
      if (!kanaOnly) expect(w.hiragana, w.id).toMatch(/^[぀-ゟー]+$/)
      expect(w.full_explanation, w.id).toContain('**用法**')
      expect(w.full_explanation, w.id).toMatch(/\*\*例句\*\*：.+\n\n（.+）$/)
    }
  })
})

describe('N3 grammar', () => {
  const items = bySeries('N3 文法').flatMap((d) => d.data as GrammarItem[])

  it('has 30 grammar points, each with explanation and two translated examples', () => {
    expect(items).toHaveLength(30)
    for (const g of items) {
      expect(g.full_explanation, g.id).toContain('**接續**')
      expect(g.examples, g.id).toHaveLength(2)
      for (const ex of g.examples!) {
        expect(checkGrammarMarkup(ex.sentence), `${g.id}: ${ex.sentence}`).toBeNull()
        expect(ex.translation, g.id).toBeTruthy()
      }
    }
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
