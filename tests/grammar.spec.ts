import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import FlashCard from '@/components/FlashCard.vue'
import { buildChoices, isCorrectInput } from '@/lib/answerMethods'
import { buildPracticeDeck, countPracticeItems } from '@/lib/deck'
import { buildStudyQueue, countDataset } from '@/lib/queue'
import { buildCard, isModeAvailable, modesForItem } from '@/lib/quizModes'
import { useQuizSessionStore, useStudySessionStore } from '@/stores/studySession'
import type { Dataset, GrammarItem } from '@/types/dataset'

const items: GrammarItem[] = [
  {
    id: 'uchi',
    japanese: 'うちに',
    simple_chinese: '趁～',
    full_explanation: '**接續**',
    examples: [
      { sentence: '若い【うちに】勉強しなさい。', translation: '趁年輕時讀書吧。' },
      { sentence: '話している【うちに】好きになった。', translation: '聊著聊著就喜歡上了。' },
    ],
  },
  {
    id: 'you',
    japanese: 'ようにする',
    simple_chinese: '盡量～',
    examples: [{ sentence: '毎日野菜を食べる【ようにしています】。' }],
  },
  {
    id: 'koto',
    japanese: 'ことにする',
    simple_chinese: '決定～',
    examples: [{ sentence: '留学する【ことにしました】。', translation: '決定去留學。' }],
  },
  {
    id: 'wake',
    japanese: 'わけではない',
    simple_chinese: '並不是～',
    examples: [{ sentence: '嫌いな【わけではない】。' }],
  },
  { id: 'sae', japanese: 'さえ～ば', simple_chinese: '只要～就' },
]

const grammar: Dataset = {
  id: 'grammar/t',
  name: 'G',
  category: 'grammar',
  level: 'N3',
  data: items,
}
const first = () => 0

describe('mode availability', () => {
  it('requires examples for the sentence modes', () => {
    expect(isModeAvailable('grammar-cloze', items[0]!)).toBe(true)
    expect(isModeAvailable('grammar-cloze', items[4]!)).toBe(false)
    expect(isModeAvailable('grammar-sentence-to-zh', items[4]!)).toBe(false)
    expect(isModeAvailable('grammar-zh-to-pattern', items[4]!)).toBe(true)
  })

  it('filters modes by category and availability', () => {
    const all = ['vocab-zh-to-jp', 'grammar-cloze', 'grammar-pattern-to-zh'] as const
    expect(modesForItem(grammar, items[0]!, all)).toEqual([
      'grammar-cloze',
      'grammar-pattern-to-zh',
    ])
    expect(modesForItem(grammar, items[4]!, all)).toEqual(['grammar-pattern-to-zh'])
  })
})

describe('sentence cards', () => {
  it('highlighted sentence → Chinese shows the marked sentence and the translation on the back', () => {
    const card = buildCard(grammar, items[0]!, 'grammar-sentence-to-zh', first)
    expect(card.front).toEqual({
      text: '若いうちに勉強しなさい。',
      lang: 'ja',
      sentence: '若い【うちに】勉強しなさい。',
      cloze: false,
    })
    expect(card.back).toMatchObject({
      text: '趁～',
      sub: { text: 'うちに' },
      note: { text: '趁年輕時讀書吧。', lang: 'zh' },
      explanation: '**接續**',
    })
  })

  it('picks a random example', () => {
    const card = buildCard(grammar, items[0]!, 'grammar-sentence-to-zh', () => 0.99)
    expect(card.front.sentence).toBe('話している【うちに】好きになった。')
  })

  it('cloze blanks the marked part, shows the translation, and answers with the blank', () => {
    const card = buildCard(grammar, items[1]!, 'grammar-cloze', first)
    expect(card.front).toMatchObject({
      text: '毎日野菜を食べる＿＿。',
      cloze: true,
      sentence: '毎日野菜を食べる【ようにしています】。',
    })
    expect(card.front.note).toBeUndefined() // 這個例句沒有翻譯
    expect(card.back).toMatchObject({
      text: 'ようにしています',
      sub: { sentence: '毎日野菜を食べる【ようにしています】。', cloze: false },
      note: { text: 'ようにする：盡量～' },
    })
    expect(card.answers).toEqual(['ようにしています'])
    expect(isCorrectInput('ようにしています', card.answers!)).toBe(true)
    expect(isCorrectInput('ようにする', card.answers!)).toBe(false)
  })

  it('joins multiple blanks', () => {
    const multi: GrammarItem = {
      id: 'm',
      japanese: 'A～B',
      simple_chinese: 'x',
      examples: [{ sentence: '【さえ】あれ【ば】いい' }],
    }
    const card = buildCard(grammar, multi, 'grammar-cloze', first)
    expect(card.front.text).toBe('＿＿あれ＿＿いい')
    expect(card.back.text).toBe('さえ…ば')
    expect(isCorrectInput('さえば', card.answers!)).toBe(true)
  })

  it('builds cloze distractors only from items that have examples', () => {
    const card = buildCard(grammar, items[0]!, 'grammar-cloze', first)
    const choices = buildChoices(card, [grammar])!
    expect(choices.sort()).toEqual(
      ['うちに', 'ことにしました', 'わけではない', 'ようにしています'].sort(),
    )
  })
})

describe('decks and queues skip unavailable modes', () => {
  it('free practice skips items without a usable mode', () => {
    const deck = buildPracticeDeck([grammar], ['grammar-cloze'])
    expect(deck.map((c) => c.itemId).sort()).toEqual(['koto', 'uchi', 'wake', 'you'])
    expect(countPracticeItems([grammar], ['grammar-cloze'])).toBe(4)
    expect(countPracticeItems([grammar], ['grammar-cloze', 'grammar-zh-to-pattern'])).toBe(5)
  })

  it('the SRS queue never gives an item without examples a sentence mode', () => {
    for (let i = 0; i < 10; i++) {
      const queue = buildStudyQueue({
        datasets: [grammar],
        modeIds: ['grammar-cloze', 'grammar-sentence-to-zh', 'grammar-pattern-to-zh'],
        progress: () => undefined,
        newLimit: 10,
        now: 0,
      })
      expect(queue.find((c) => c.itemId === 'sae')?.modeId).toBe('grammar-pattern-to-zh')
    }
  })

  it('counts only items that can be asked', () => {
    expect(countDataset(grammar, ['grammar-cloze'], () => undefined, 0)).toEqual({
      due: 0,
      seen: 0,
      unseen: 4,
    })
  })
})

describe('enabled modes', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('turns new modes on by default', () => {
    expect(useStudySessionStore().enabledModes).toContain('grammar-cloze')
  })

  it('migrates the old enabled list without disabling the new modes', () => {
    localStorage.setItem(
      'jla:v1:study-modes',
      JSON.stringify(['vocab-zh-to-jp', 'grammar-zh-to-pattern']),
    )
    const modes = useStudySessionStore().enabledModes
    expect(modes).toEqual([
      'vocab-zh-to-jp',
      'grammar-sentence-to-zh',
      'grammar-zh-to-pattern',
      'grammar-cloze',
    ])
  })

  it('saves disabled modes separately for study and quiz', () => {
    useStudySessionStore().toggleMode('grammar-cloze')
    expect(useStudySessionStore().enabledModes).not.toContain('grammar-cloze')
    expect(useQuizSessionStore().enabledModes).toContain('grammar-cloze')

    setActivePinia(createPinia())
    expect(useStudySessionStore().enabledModes).not.toContain('grammar-cloze')
  })
})

describe('FlashCard with sentences', () => {
  it('renders the cloze blank and translation in front, and the highlighted answer behind', async () => {
    const card = buildCard(grammar, items[2]!, 'grammar-cloze', first)
    const wrapper = mount(FlashCard, { props: { card, flipped: false } })
    await flushPromises()

    const front = wrapper.find('.front')
    expect(front.find('.cloze-blank').exists()).toBe(true)
    expect(front.text()).not.toContain('ことにしました')
    expect(front.find('.note').text()).toBe('決定去留學。')

    const back = wrapper.find('.back')
    expect(back.find('.main').text()).toBe('ことにしました')
    expect(back.find('.sub mark.grammar-mark').text()).toBe('ことにしました')
  })

  it('highlights the grammar in sentence → Chinese cards', () => {
    const card = buildCard(grammar, items[0]!, 'grammar-sentence-to-zh', first)
    const wrapper = mount(FlashCard, { props: { card, flipped: false } })
    expect(wrapper.find('.front mark.grammar-mark').text()).toBe('うちに')
    expect(wrapper.find('.back .note').text()).toBe('趁年輕時讀書吧。')
  })
})
