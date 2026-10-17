import { describe, expect, it } from 'vitest'

import { buildPracticeDeck } from '@/lib/deck'
import { parseMarkedSentence, stripMarkup } from '@/lib/grammarMarkup'
import { renderMarkdown } from '@/lib/markdown'
import { buildCard } from '@/lib/quizModes'
import { pickRandom, shuffle } from '@/lib/shuffle'
import type { Dataset, VocabularyItem } from '@/types/dataset'

/** 可重現的偽亂數 */
function seeded(seed = 1) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

const vocab: Dataset = {
  id: 'vocabulary/test',
  name: '單字',
  category: 'vocabulary',
  level: 'N3',
  data: [
    {
      id: 'v1',
      japanese: '株式',
      hiragana: 'かぶしき',
      simple_chinese: '股份',
      full_explanation: '**股票**',
    },
    { id: 'v2', japanese: 'コスト', simple_chinese: '成本' },
  ],
}

const grammar: Dataset = {
  id: 'grammar/test',
  name: '文法',
  category: 'grammar',
  level: 'N3',
  data: [{ id: 'g1', japanese: 'うちに', simple_chinese: '趁～' }],
}

describe('shuffle', () => {
  it('returns a permutation without mutating the input', () => {
    const input = Array.from({ length: 20 }, (_, i) => i)
    const result = shuffle(input, seeded(42))
    expect(input).toEqual(Array.from({ length: 20 }, (_, i) => i))
    expect([...result].sort((a, b) => a - b)).toEqual(input)
    expect(result).not.toEqual(input)
  })

  it('is deterministic for the same random source', () => {
    expect(shuffle([1, 2, 3, 4, 5], seeded(7))).toEqual(shuffle([1, 2, 3, 4, 5], seeded(7)))
  })

  it('handles empty and single-item arrays', () => {
    expect(shuffle([])).toEqual([])
    expect(shuffle(['a'])).toEqual(['a'])
  })

  it('pickRandom picks by the random value and rejects empty arrays', () => {
    expect(pickRandom(['a', 'b', 'c'], () => 0.99)).toBe('c')
    expect(() => pickRandom([])).toThrow()
  })
})

describe('buildCard', () => {
  const [kabu, cost] = vocab.data as [VocabularyItem, VocabularyItem]

  it('kanji → Chinese shows the word and answers with meaning plus reading', () => {
    const card = buildCard(vocab, kabu, 'vocab-kanji-to-zh')
    expect(card.key).toBe('vocabulary/test:v1:vocab-kanji-to-zh')
    expect(card.front).toEqual({ text: '株式', lang: 'ja' })
    expect(card.back).toEqual({
      text: '股份',
      lang: 'zh',
      sub: { text: '株式（かぶしき）', lang: 'ja' },
      explanation: '**股票**',
    })
  })

  it('kana → Chinese shows the reading', () => {
    expect(buildCard(vocab, kabu, 'vocab-kana-to-zh').front.text).toBe('かぶしき')
  })

  it('Chinese → Japanese answers with the word and its reading', () => {
    const card = buildCard(vocab, kabu, 'vocab-zh-to-jp')
    expect(card.front).toEqual({ text: '股份', lang: 'zh' })
    expect(card.back.text).toBe('株式')
    expect(card.back.sub).toEqual({ text: 'かぶしき', lang: 'ja' })
  })

  it('words without kanji fall back to japanese and do not repeat the reading', () => {
    expect(buildCard(vocab, cost, 'vocab-kana-to-zh').front.text).toBe('コスト')
    expect(buildCard(vocab, cost, 'vocab-kanji-to-zh').back.sub?.text).toBe('コスト')
    expect(buildCard(vocab, cost, 'vocab-zh-to-jp').back.sub).toBeUndefined()
  })

  it('builds grammar cards in both directions', () => {
    const item = grammar.data[0]!
    expect(buildCard(grammar, item, 'grammar-pattern-to-zh').back.text).toBe('趁～')
    expect(buildCard(grammar, item, 'grammar-zh-to-pattern').back.text).toBe('うちに')
  })
})

describe('buildPracticeDeck', () => {
  it('includes every item once with a mode matching its category', () => {
    const deck = buildPracticeDeck(
      [vocab, grammar],
      ['vocab-kanji-to-zh', 'vocab-zh-to-jp', 'grammar-zh-to-pattern'],
      seeded(3),
    )
    expect(deck.map((c) => c.itemId).sort()).toEqual(['g1', 'v1', 'v2'])
    for (const card of deck) {
      if (card.datasetId === 'grammar/test') expect(card.modeId).toBe('grammar-zh-to-pattern')
      else expect(['vocab-kanji-to-zh', 'vocab-zh-to-jp']).toContain(card.modeId)
    }
  })

  it('skips datasets whose category has no enabled mode', () => {
    const deck = buildPracticeDeck([vocab, grammar], ['grammar-pattern-to-zh'])
    expect(deck.map((c) => c.itemId)).toEqual(['g1'])
  })
})

describe('markdown', () => {
  it('renders markdown and escapes raw HTML', () => {
    const html = renderMarkdown('**粗體**\n<script>alert(1)</script>')
    expect(html).toContain('<strong>粗體</strong>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('drops javascript: links and opens others in a new tab', () => {
    expect(renderMarkdown('[x](javascript:alert(1))')).not.toContain('href="javascript:')
    expect(renderMarkdown('[x](https://example.com)')).toContain('target="_blank"')
  })
})

describe('grammarMarkup', () => {
  it('splits marked sentences into segments', () => {
    expect(parseMarkedSentence('若い【うちに】勉強する。')).toEqual([
      { text: '若い', marked: false },
      { text: 'うちに', marked: true },
      { text: '勉強する。', marked: false },
    ])
    expect(parseMarkedSentence('【A】と【B】')).toEqual([
      { text: 'A', marked: true },
      { text: 'と', marked: false },
      { text: 'B', marked: true },
    ])
  })

  it('strips markup for speech', () => {
    expect(stripMarkup('若い【うちに】勉強する。')).toBe('若いうちに勉強する。')
  })
})
