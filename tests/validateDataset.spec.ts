import { describe, expect, it } from 'vitest'
import { checkGrammarMarkup, validateDataset } from '@/lib/validateDataset'

const vocab = (data: unknown[]) => ({ name: '單字', category: 'vocabulary', level: 'N3', data })
const grammar = (data: unknown[]) => ({ name: '文法', category: 'grammar', level: 'N3', data })

describe('validateDataset', () => {
  it('accepts a valid vocabulary dataset, with or without hiragana', () => {
    const result = validateDataset(
      vocab([
        { id: '1', japanese: '株式', hiragana: 'かぶしき', simple_chinese: '股份' },
        { id: '2', japanese: 'コスト', simple_chinese: '成本', full_explanation: '**成本**' },
      ]),
    )
    expect(result).toMatchObject({ ok: true, errors: [] })
  })

  it('accepts a valid grammar dataset with marked examples', () => {
    const result = validateDataset(
      grammar([
        {
          id: 'g1',
          japanese: 'うちに',
          simple_chinese: '趁～',
          examples: [{ sentence: '若い【うちに】勉強する。', translation: '趁年輕讀書。' }],
        },
        { id: 'g2', japanese: 'ことにする', simple_chinese: '決定～' },
      ]),
    )
    expect(result.ok).toBe(true)
  })

  it('rejects non-objects', () => {
    expect(validateDataset([])).toEqual({ ok: false, errors: ['檔案內容必須是 JSON 物件'] })
  })

  it('reports bad top-level fields', () => {
    const result = validateDataset({ name: '', category: 'kanji', level: 'N6', data: {} })
    expect(result.errors).toEqual([
      '缺少 name',
      'category 必須是 vocabulary / grammar',
      'level 必須是 N5 / N4 / N3 / N2 / N1',
      'data 必須是陣列',
    ])
  })

  it('reports missing fields and duplicate ids', () => {
    const result = validateDataset(
      vocab([
        { id: 'a', japanese: '株式', simple_chinese: '股份' },
        { id: 'a', japanese: '景気', simple_chinese: '景氣' },
        { japanese: '', simple_chinese: '產品', hiragana: 1 },
      ]),
    )
    expect(result.errors).toEqual([
      'data[1]（id: a）：id 重複',
      'data[2]：缺少 id',
      'data[2]：缺少 japanese',
      'data[2]：hiragana 必須是字串',
    ])
  })

  it('reports bad grammar examples', () => {
    const result = validateDataset(
      grammar([
        {
          id: 'g1',
          japanese: 'うちに',
          simple_chinese: '趁～',
          examples: [{ sentence: '若いうちに勉強する。' }, { translation: '缺例句' }, 'x'],
        },
      ]),
    )
    expect(result.errors).toEqual([
      'data[0]（id: g1） examples[0]：沒有用【】標記文法',
      'data[0]（id: g1） examples[1]：缺少 sentence',
      'data[0]（id: g1） examples[2]：必須是物件',
    ])
  })
})

describe('checkGrammarMarkup', () => {
  it.each([
    ['若い【うちに】勉強する。', null],
    ['【A】と【B】', null],
    ['若いうちに', '沒有用【】標記文法'],
    ['若い【うちに勉強する。', '缺少對應的 】'],
    ['若いうちに】', '多出一個 】'],
    ['【【うちに】】', '【】不可巢狀'],
    ['若い【 】', '【】內不可為空'],
  ])('%s → %s', (sentence, expected) => {
    expect(checkGrammarMarkup(sentence)).toBe(expected)
  })
})
