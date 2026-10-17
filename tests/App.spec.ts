import { describe, expect, it } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import App from '@/App.vue'
import { routes } from '@/router'

async function mountAt(path: string) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  router.push(path)
  await router.isReady()
  const wrapper = mount(App, { global: { plugins: [createPinia(), router] } })
  await flushPromises()
  return wrapper
}

describe('App', () => {
  it('shows the navigation and the home page', async () => {
    const wrapper = await mountAt('/')
    expect(wrapper.find('nav').text()).toContain('學習')
    expect(wrapper.find('h1').text()).toBe('選擇資料集')
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
