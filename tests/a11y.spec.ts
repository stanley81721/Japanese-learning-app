import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import axe from 'axe-core'

import App from '@/App.vue'
import { routes } from '@/router'
import { useDatasetsStore } from '@/stores/datasets'
import { useProgressStore } from '@/stores/progress'
import { useStudySessionStore } from '@/stores/studySession'

let wrapper: VueWrapper
let pinia: Pinia

async function mountAt(path: string, selected: string[] = []) {
  localStorage.setItem('jla:v1:selected-datasets', JSON.stringify(selected))
  localStorage.setItem('jla:v1:settings', JSON.stringify({ answerMethods: ['flip'] }))
  const router = createRouter({ history: createMemoryHistory(), routes })
  router.push(path)
  await router.isReady()
  pinia = createPinia()
  wrapper = mount(App, { global: { plugins: [pinia, router] }, attachTo: document.body })
  await useDatasetsStore(pinia).ensureLoaded()
  await flushPromises()
}

afterEach(() => wrapper?.unmount())

// axe 會用 canvas 檢查圖示字型；jsdom 沒有 canvas，回傳 null 讓它略過（避免大量錯誤訊息）
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() =>
    null) as typeof HTMLCanvasElement.prototype.getContext
})

const press = async (key: string, target: EventTarget = window) => {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  await flushPromises()
}

/** jsdom 無法計算顏色，所以不檢查對比（對比已在瀏覽器中用 axe 檢查過） */
async function violations() {
  const result = await axe.run(document.body, {
    rules: { 'color-contrast': { enabled: false } },
    resultTypes: ['violations'],
  })
  return result.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  )
}

describe('axe (structure)', () => {
  it.each(['/', '/study', '/quiz', '/browse', '/stats', '/settings'])(
    '%s has no violations',
    async (path) => {
      await mountAt(path, ['vocabulary/n4-daily-sample'])
      if (path === '/stats') {
        useProgressStore(pinia).review(
          'vocabulary/n4-daily-sample:n4-daily-001:vocab-kanji-to-zh',
          'good',
          Date.now(),
        )
        await flushPromises()
      }
      expect(await violations()).toEqual([])
    },
  )

  it('an active study session has no violations', async () => {
    await mountAt('/study', ['vocabulary/n4-daily-sample'])
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('開始學習'))!
      .trigger('click')
    expect(wrapper.find('[role="progressbar"]').attributes('aria-label')).toBe('本次進度')
    expect(wrapper.find('h1').text()).toBe('記憶複習')
    expect(await violations()).toEqual([])
  })
})

describe('axe (cards)', () => {
  it('a cloze card announces the blank without invalid ARIA', async () => {
    localStorage.setItem(
      'jla:v1:study-modes-disabled',
      JSON.stringify(['grammar-pattern-to-zh', 'grammar-sentence-to-zh', 'grammar-zh-to-pattern']),
    )
    await mountAt('/study', ['grammar/n3-grammar-sample'])
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('開始學習'))!
      .trigger('click')
    const blank = wrapper.find('.front .cloze-blank')
    expect(blank.text()).toBe('（空格）')
    expect(await violations()).toEqual([])
  })
})

describe('keyboard shortcuts dialog', () => {
  it('opens with ?, closes with Escape, and restores focus', async () => {
    await mountAt('/')
    const opener = wrapper.find('.shortcuts-button').element as HTMLButtonElement
    opener.focus()

    await press('?')
    const dialog = wrapper.find('[role="dialog"]')
    expect(dialog.exists()).toBe(true)
    expect(dialog.text()).toContain('朗讀日文')
    expect(document.activeElement?.textContent).toContain('關閉')

    await press('Escape')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(document.activeElement).toBe(opener)
  })

  it('does not open while typing', async () => {
    await mountAt('/browse')
    const input = wrapper.find('input[type="search"]').element
    await press('?', input)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('blocks study shortcuts while it is open', async () => {
    await mountAt('/study', ['vocabulary/n4-daily-sample'])
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('開始學習'))!
      .trigger('click')
    const session = useStudySessionStore(pinia)

    await press('?')
    await press(' ')
    expect(session.flipped).toBe(false)

    await press('Escape')
    await press(' ')
    expect(session.flipped).toBe(true)
  })
})

describe('skip link', () => {
  it('moves focus to the main content', async () => {
    await mountAt('/')
    await wrapper.find('.skip-link').trigger('click')
    expect(document.activeElement?.id).toBe('main')
  })
})
