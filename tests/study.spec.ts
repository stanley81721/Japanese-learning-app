import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import App from '@/App.vue'
import { buildCard } from '@/lib/quizModes'
import { routes } from '@/router'
import { useDatasetsStore } from '@/stores/datasets'
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

  it('requires flipping before answering and records results', () => {
    const session = useStudySessionStore()
    expect(session.status).toBe('setup')

    session.start(deck)
    expect(session.status).toBe('active')

    session.answer(true) // 還沒翻面，無效
    expect(session.index).toBe(0)

    session.flip()
    session.answer(true)
    session.flip()
    session.answer(false)

    expect(session.status).toBe('finished')
    expect(session.knownCount).toBe(1)
    expect(session.unknownCards.map((c) => c.itemId)).toEqual(['2'])

    session.retryUnknown()
    expect(session.cards.map((c) => c.itemId)).toEqual(['2'])
    expect(session.status).toBe('active')
  })

  it('remembers enabled modes', () => {
    const session = useStudySessionStore()
    session.toggleMode('vocab-zh-to-jp')
    expect(session.enabledModes).not.toContain('vocab-zh-to-jp')

    setActivePinia(createPinia())
    expect(useStudySessionStore().enabledModes).not.toContain('vocab-zh-to-jp')
  })
})

describe('datasets selection persistence', () => {
  it('restores the selection from localStorage', () => {
    setActivePinia(createPinia())
    useDatasetsStore().toggleSelected('vocabulary/a')
    return flushPromises().then(() => {
      setActivePinia(createPinia())
      expect(useDatasetsStore().selectedIds).toEqual(['vocabulary/a'])
    })
  })
})

describe('StudyView', () => {
  async function mountStudy(selected: string[]) {
    localStorage.setItem('jla:v1:selected-datasets', JSON.stringify(selected))
    const router = createRouter({ history: createMemoryHistory(), routes })
    router.push('/study')
    await router.isReady()
    const pinia = createPinia()
    const wrapper = mount(App, { global: { plugins: [pinia, router] }, attachTo: document.body })
    await useDatasetsStore(pinia).ensureLoaded()
    await flushPromises()
    return wrapper
  }

  it('asks to choose datasets when none are selected', async () => {
    const wrapper = await mountStudy([])
    expect(wrapper.text()).toContain('還沒有選擇資料集')
    wrapper.unmount()
  })

  it('runs a full practice session with the keyboard', async () => {
    const wrapper = await mountStudy(['vocabulary/n4-daily-sample'])
    expect(wrapper.text()).toContain('本次 6 張卡')

    await wrapper.find('.start-row .btn-primary').trigger('click')
    expect(wrapper.find('.counter').text()).toBe('1 / 6')

    for (let i = 0; i < 6; i++) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
      await flushPromises()
      expect(wrapper.find('.flashcard').classes()).toContain('flipped')
      window.dispatchEvent(new KeyboardEvent('keydown', { key: i < 2 ? '1' : '2' }))
      await flushPromises()
    }

    expect(wrapper.find('h1').text()).toBe('練習完成')
    expect(wrapper.find('.stat.success').text()).toBe('4')
    expect(wrapper.find('.stat.danger').text()).toBe('2')
    expect(wrapper.text()).toContain('再練一次不會的（2）')
    wrapper.unmount()
  })

  it('disables starting when no mode is enabled for the selected category', async () => {
    const wrapper = await mountStudy(['grammar/n3-grammar-sample'])
    for (const box of wrapper.findAll('.mode-option input')) await box.setValue(false)
    expect(wrapper.find('.start-row .btn-primary').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
})
