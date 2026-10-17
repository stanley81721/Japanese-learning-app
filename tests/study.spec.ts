import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import App from '@/App.vue'
import { buildCard } from '@/lib/quizModes'
import { routes } from '@/router'
import { useDatasetsStore } from '@/stores/datasets'
import { useProgressStore } from '@/stores/progress'
import { useStudySessionStore } from '@/stores/studySession'
import type { Dataset } from '@/types/dataset'

const dataset: Dataset = {
  id: 'vocabulary/t',
  name: 'T',
  category: 'vocabulary',
  level: 'N5',
  data: [
    { id: '1', japanese: '一', simple_chinese: '一' },
    { id: '2', japanese: '二', simple_chinese: '二' },
  ],
}
const deck = dataset.data.map((item) => buildCard(dataset, item, 'vocab-kanji-to-zh'))

describe('study session store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('practice mode: requires flipping, records results, and does not save progress', () => {
    const session = useStudySessionStore()
    expect(session.status).toBe('setup')

    session.start(deck, 'practice')
    session.answer('good') // 還沒翻面，無效
    expect(session.index).toBe(0)

    session.flip()
    session.answer('good')
    session.flip()
    session.answer('again')

    expect(session.status).toBe('finished')
    expect(session.knownCount).toBe(1)
    expect(session.unknownCards.map((c) => c.itemId)).toEqual(['2'])
    expect(useProgressStore().totalCards).toBe(0)

    session.retryUnknown()
    expect(session.queue.map((c) => c.itemId)).toEqual(['2'])
  })

  it('srs mode: saves progress and requeues cards still being learned', () => {
    const session = useStudySessionStore()
    const progress = useProgressStore()
    session.start([...deck], 'srs')

    session.flip()
    session.answer('again') // 學習中 → 插回佇列
    expect(session.queue).toHaveLength(3)
    expect(progress.get(deck[0]!.key)).toMatchObject({ state: 'learning' })

    session.flip()
    session.answer('easy') // 直接畢業 → 不再出現
    expect(session.queue).toHaveLength(3)

    session.flip()
    session.answer('easy')
    expect(session.status).toBe('finished')
    expect(session.studiedCount).toBe(2)
    expect(session.unknownCards).toHaveLength(1)
    expect(session.reviewCount).toBe(3)
    expect(progress.get(deck[0]!.key)).toMatchObject({ state: 'review', interval: 4 })
  })

  it('previews intervals only in srs mode', () => {
    const session = useStudySessionStore()
    session.start([...deck], 'srs')
    expect(session.intervalPreview).toMatchObject({ good: '10 分', easy: '4 天' })
    session.start([...deck], 'practice')
    expect(session.intervalPreview).toBeNull()
  })

  it('remembers enabled modes', () => {
    useStudySessionStore().toggleMode('vocab-zh-to-jp')
    setActivePinia(createPinia())
    expect(useStudySessionStore().enabledModes).not.toContain('vocab-zh-to-jp')
  })
})

describe('datasets selection persistence', () => {
  it('restores the selection from localStorage', async () => {
    setActivePinia(createPinia())
    useDatasetsStore().toggleSelected('vocabulary/a')
    await flushPromises()
    setActivePinia(createPinia())
    expect(useDatasetsStore().selectedIds).toEqual(['vocabulary/a'])
  })
})

describe('StudyView', () => {
  let wrapper: VueWrapper

  async function mountStudy(selected: string[]) {
    localStorage.setItem('jla:v1:selected-datasets', JSON.stringify(selected))
    const router = createRouter({ history: createMemoryHistory(), routes })
    router.push('/study')
    await router.isReady()
    const pinia = createPinia()
    wrapper = mount(App, { global: { plugins: [pinia, router] }, attachTo: document.body })
    await useDatasetsStore(pinia).ensureLoaded()
    await flushPromises()
    return wrapper
  }

  async function press(key: string) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }))
    await flushPromises()
  }

  const button = (text: string) => wrapper.findAll('button').find((b) => b.text().includes(text))!

  beforeEach(() => wrapper?.unmount())

  it('asks to choose datasets when none are selected', async () => {
    await mountStudy([])
    expect(wrapper.text()).toContain('還沒有選擇資料集')
  })

  it('studies new cards with SRS until they graduate, then has nothing left today', async () => {
    // 上限 6：學完後其他測驗方向不會再被當成今天的新卡
    localStorage.setItem('jla:v1:settings', JSON.stringify({ newCardsPerDay: 6 }))
    await mountStudy(['vocabulary/n4-daily-sample'])
    expect(button('開始學習').text()).toContain('6')

    await button('開始學習').trigger('click')
    expect(wrapper.text()).toContain('剩 6 張')

    // 新卡按「良好」兩次才會畢業（1 → 10 分 → 1 天），所以共 12 次
    let presses = 0
    while (wrapper.find('.flashcard').exists() && presses < 20) {
      await press(' ')
      expect(wrapper.find('.flashcard').classes()).toContain('flipped')
      await press('3')
      presses++
    }
    expect(presses).toBe(12)
    expect(wrapper.find('h1').text()).toBe('今天的學習完成了')

    await button('回到設定').trigger('click')
    expect(wrapper.text()).toContain('今天的卡片都完成了')
    expect(button('開始學習').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('今天已學 6 張')
  })

  it('respects the daily new card limit', async () => {
    localStorage.setItem('jla:v1:settings', JSON.stringify({ newCardsPerDay: 2 }))
    await mountStudy(['vocabulary/n4-daily-sample'])
    expect(button('開始學習').text()).toContain('2')
  })

  it('free practice uses two buttons and keys 1/2', async () => {
    await mountStudy(['vocabulary/n4-daily-sample'])
    await button('自由練習').trigger('click')

    for (let i = 0; i < 6; i++) {
      await press(' ')
      await press(i < 2 ? '1' : '2')
    }

    expect(wrapper.find('h1').text()).toBe('練習完成')
    expect(wrapper.find('.stat-num.good').text()).toBe('4')
    expect(wrapper.find('.stat-num.again').text()).toBe('2')
    expect(button('再練一次忘記的').text()).toContain('2')
  })

  it('disables starting when no mode is enabled for the selected category', async () => {
    await mountStudy(['grammar/n3-grammar-sample'])
    for (const box of wrapper.findAll('.mode-option input')) await box.setValue(false)
    expect(button('開始學習').attributes('disabled')).toBeDefined()
    expect(button('自由練習').attributes('disabled')).toBeDefined()
  })
})
