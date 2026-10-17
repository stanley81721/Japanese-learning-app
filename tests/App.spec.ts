import { describe, expect, it } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import App from '@/App.vue'
import { routes } from '@/router'
import { useDatasetsStore } from '@/stores/datasets'

async function mountAt(path: string) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  router.push(path)
  await router.isReady()
  const pinia = createPinia()
  const wrapper = mount(App, { global: { plugins: [pinia, router] } })
  // 等待 data/ 的 JSON 動態載入完成
  await useDatasetsStore(pinia).ensureLoaded()
  await flushPromises()
  return wrapper
}

describe('App', () => {
  it('shows the navigation and the datasets from data/ on the home page', async () => {
    const wrapper = await mountAt('/')
    expect(wrapper.find('nav').text()).toContain('學習')
    expect(wrapper.find('h1').text()).toBe('選擇資料集')
    expect(wrapper.text()).toContain('N3 商業單字（範例）')
    expect(wrapper.text()).toContain('N3 文法（範例）')
  })

  it('filters datasets and tracks the selection', async () => {
    const wrapper = await mountAt('/')
    const chip = (label: string) => wrapper.findAll('button.chip').find((b) => b.text() === label)!

    await chip('文法').trigger('click')
    expect(wrapper.findAll('.dataset-card')).toHaveLength(1)

    await wrapper.find('.dataset-card input').setValue(true)
    expect(wrapper.find('.selection-bar').text()).toContain('已選 1 份，共 6 筆')

    await chip('N5').trigger('click')
    expect(wrapper.text()).toContain('沒有符合條件的資料集。')
  })

  it.each([
    ['/study', '學習'],
    ['/quiz', '測驗'],
    ['/browse', '瀏覽'],
    ['/stats', '統計'],
    ['/settings', '設定'],
  ])('renders %s', async (path, heading) => {
    const wrapper = await mountAt(path)
    expect(wrapper.find('h1').text()).toBe(heading)
  })

  it('redirects unknown paths to home', async () => {
    const wrapper = await mountAt('/does-not-exist')
    expect(wrapper.find('h1').text()).toBe('選擇資料集')
  })
})
