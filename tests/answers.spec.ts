import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import App from '@/App.vue'
import {
  assignAnswerMethod,
  buildChoices,
  canInput,
  isCorrectInput,
  normalizeAnswer,
} from '@/lib/answerMethods'
import { buildCard } from '@/lib/quizModes'
import { routes } from '@/router'
import { useDatasetsStore } from '@/stores/datasets'
import { useProgressStore } from '@/stores/progress'
import { useSettingsStore } from '@/stores/settings'
import { useQuizSessionStore, useStudySessionStore } from '@/stores/studySession'
import type { Dataset } from '@/types/dataset'

const vocab: Dataset = {
  id: 'vocabulary/t',
  name: 'T',
  category: 'vocabulary',
  level: 'N5',
  data: [
    { id: '1', japanese: '株式', hiragana: 'かぶしき', simple_chinese: '股份' },
    { id: '2', japanese: '景気', hiragana: 'けいき', simple_chinese: '景氣' },
    { id: '3', japanese: '製品', hiragana: 'せいひん', simple_chinese: '產品' },
    { id: '4', japanese: '輸出', hiragana: 'ゆしゅつ', simple_chinese: '出口' },
    { id: '5', japanese: 'コスト', simple_chinese: '成本' },
  ],
}
const grammar: Dataset = {
  id: 'grammar/t',
  name: 'G',
  category: 'grammar',
  level: 'N5',
  data: [
    { id: 'g1', japanese: 'さえ～ば', simple_chinese: '只要～就' },
    { id: 'g2', japanese: 'うちに', simple_chinese: '趁～' },
  ],
}
const card = (i: number, mode: Parameters<typeof buildCard>[2] = 'vocab-kanji-to-zh') =>
  buildCard(vocab, vocab.data[i]!, mode)

describe('normalizeAnswer / isCorrectInput', () => {
  it('ignores width, spaces, punctuation, wave dashes, and katakana vs hiragana', () => {
    expect(normalizeAnswer(' ｶﾌﾞｼｷ。 ')).toBe('かぶしき')
    expect(normalizeAnswer('さえ～ば')).toBe('さえば')
    expect(normalizeAnswer('ＡＢＣ')).toBe('abc')
  })

  it('accepts the kanji or the reading', () => {
    const answers = card(0, 'vocab-zh-to-jp').answers!
    expect(answers).toEqual(['株式', 'かぶしき'])
    expect(isCorrectInput('株式', answers)).toBe(true)
    expect(isCorrectInput('カブシキ', answers)).toBe(true)
    expect(isCorrectInput('かぶ', answers)).toBe(false)
    expect(isCorrectInput('   ', answers)).toBe(false)
  })

  it('accepts katakana words typed in hiragana', () => {
    expect(isCorrectInput('こすと', card(4, 'vocab-zh-to-jp').answers!)).toBe(true)
  })
})

describe('canInput', () => {
  it('only allows typing when the answer is Japanese', () => {
    expect(canInput(card(0, 'vocab-zh-to-jp'))).toBe(true)
    expect(canInput(card(0, 'vocab-kanji-to-zh'))).toBe(false)
    expect(canInput(buildCard(grammar, grammar.data[0]!, 'grammar-zh-to-pattern'))).toBe(true)
  })
})

describe('buildChoices', () => {
  it('returns the answer plus three distinct distractors from the same category', () => {
    const choices = buildChoices(card(0), [vocab, grammar])!
    expect(choices).toHaveLength(4)
    expect(choices).toContain('股份')
    expect(new Set(choices).size).toBe(4)
    for (const c of choices) expect(['股份', '景氣', '產品', '出口', '成本']).toContain(c)
  })

  it('returns null when there are not enough distractors', () => {
    expect(
      buildChoices(buildCard(grammar, grammar.data[0]!, 'grammar-pattern-to-zh'), [grammar]),
    ).toBeNull()
  })
})

describe('assignAnswerMethod', () => {
  it('only picks methods that fit the card, falling back to flip', () => {
    for (let i = 0; i < 20; i++) {
      const entry = assignAnswerMethod(card(0), ['choice', 'input'], [vocab])
      expect(entry.method).toBe('choice')
      expect(entry.choices).toHaveLength(4)
    }
    expect(assignAnswerMethod(card(0), ['input'], [vocab]).method).toBe('flip')
    expect(assignAnswerMethod(card(0, 'vocab-zh-to-jp'), ['input'], [vocab]).method).toBe('input')
  })

  it('uses each enabled method at random', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 60; i++) {
      seen.add(
        assignAnswerMethod(card(0, 'vocab-zh-to-jp'), ['flip', 'choice', 'input'], [vocab]).method,
      )
    }
    expect(seen).toEqual(new Set(['flip', 'choice', 'input']))
  })
})

describe('settings: answer methods', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('defaults to all methods and always keeps at least one', () => {
    const settings = useSettingsStore()
    expect(settings.answerMethods).toEqual(['flip', 'choice', 'input'])
    settings.toggleAnswerMethod('flip')
    settings.toggleAnswerMethod('choice')
    settings.toggleAnswerMethod('input')
    expect(settings.answerMethods).toEqual(['input'])
    settings.toggleAnswerMethod('flip')
    expect(settings.answerMethods).toEqual(['flip', 'input'])
  })

  it('ignores invalid saved values', () => {
    localStorage.setItem(
      'jla:v1:settings',
      JSON.stringify({ answerMethods: ['nope'], newCardsPerDay: -1 }),
    )
    const settings = useSettingsStore()
    expect(settings.answerMethods).toEqual(['flip', 'choice', 'input'])
    expect(settings.newCardsPerDay).toBe(20)
  })
})

describe('session store: choice and input', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('grades a wrong choice as again and a right one as good in SRS mode', () => {
    const session = useStudySessionStore()
    const progress = useProgressStore()
    session.start([card(0), card(1)], { mode: 'srs', methods: ['choice'], pool: [vocab] })

    const first = session.currentEntry!
    const wrong = first.choices!.findIndex((c) => c !== first.card.back.text)
    session.flip() // 選擇題不能直接翻面
    expect(session.flipped).toBe(false)

    session.submitChoice(wrong)
    expect(session.response).toMatchObject({ correct: false, choice: wrong })
    expect(session.flipped).toBe(true)
    session.submitChoice(0) // 已作答，忽略
    session.proceed()
    expect(progress.get(first.card.key)).toMatchObject({ state: 'learning', step: 0 })

    const second = session.currentEntry!
    session.submitChoice(second.choices!.indexOf(second.card.back.text))
    session.proceed()
    expect(progress.get(second.card.key)).toMatchObject({ state: 'learning', step: 1 })
  })

  it('lets a wrong typed answer be overridden as correct', () => {
    const session = useStudySessionStore()
    session.start([card(0, 'vocab-zh-to-jp')], {
      mode: 'practice',
      methods: ['input'],
      pool: [vocab],
    })
    expect(session.currentEntry!.method).toBe('input')

    session.submitInput('  ')
    expect(session.response).toBeNull()

    session.submitInput('株')
    expect(session.response).toMatchObject({ correct: false, input: '株' })
    session.overrideCorrect()
    expect(session.response).toMatchObject({ correct: true, overridden: true })
    session.proceed()
    expect(session.status).toBe('finished')
    expect(session.knownCount).toBe(1)
  })

  it('keeps study and quiz sessions separate', () => {
    useStudySessionStore().start([card(0)], { mode: 'practice' })
    expect(useQuizSessionStore().status).toBe('setup')
  })
})

describe('views', () => {
  let wrapper: VueWrapper
  let pinia: Pinia

  async function mountAt(path: string, selected: string[], settings: object) {
    localStorage.setItem('jla:v1:selected-datasets', JSON.stringify(selected))
    localStorage.setItem('jla:v1:settings', JSON.stringify(settings))
    const router = createRouter({ history: createMemoryHistory(), routes })
    router.push(path)
    await router.isReady()
    pinia = createPinia()
    wrapper = mount(App, { global: { plugins: [pinia, router] }, attachTo: document.body })
    await useDatasetsStore(pinia).ensureLoaded()
    await flushPromises()
  }

  const button = (text: string) => wrapper.findAll('button').find((b) => b.text().includes(text))!

  beforeEach(() => wrapper?.unmount())

  it('runs a multiple-choice quiz and lists the wrong answers', async () => {
    localStorage.setItem('jla:v1:quiz-count', '0')
    await mountAt('/quiz', ['vocabulary/n3-business-sample'], { answerMethods: ['choice'] })
    expect(button('開始測驗').text()).toContain('8 題')
    await button('開始測驗').trigger('click')

    const quiz = useQuizSessionStore(pinia)
    for (let i = 0; i < 8; i++) {
      const entry = quiz.currentEntry!
      expect(entry.method).toBe('choice')
      expect(wrapper.findAll('.choice')).toHaveLength(4)
      const correctIndex = entry.choices!.indexOf(entry.card.back.text)
      const pick = i < 3 ? (correctIndex + 1) % 4 : correctIndex
      window.dispatchEvent(new KeyboardEvent('keydown', { key: String(pick + 1) }))
      await flushPromises()
      expect(wrapper.find('.feedback').text()).toContain(i < 3 ? '答錯了' : '答對了')
      await button('繼續').trigger('click')
    }

    expect(wrapper.find('h1').text()).toBe('測驗結果')
    expect(wrapper.find('.score-num').text()).toContain('63')
    expect(wrapper.findAll('.wrong-list li')).toHaveLength(3)
    expect(useProgressStore(pinia).totalCards).toBe(0)
  })

  it('types an answer in the study view', async () => {
    localStorage.setItem('jla:v1:study-modes', JSON.stringify(['vocab-zh-to-jp']))
    await mountAt('/study', ['vocabulary/n4-daily-sample'], {
      answerMethods: ['input'],
      newCardsPerDay: 1,
    })
    await button('開始學習').trigger('click')

    const session = useStudySessionStore(pinia)
    const answer = session.current!.answers!.at(-1)!
    await wrapper.find('.answer-input').setValue(answer)
    await wrapper.find('form.input-row').trigger('submit')
    expect(wrapper.find('.feedback').text()).toContain('答對了')

    await button('繼續').trigger('click')
    expect(useProgressStore(pinia).get(session.queue[0]!.card.key)).toMatchObject({ step: 1 })
  })
})
