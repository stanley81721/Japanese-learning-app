import { beforeEach, vi } from 'vitest'
import { ref } from 'vue'

import type { DatasetModules } from '@/data/loader'

// 介面測試使用 tests/fixtures/data 的小型範例資料集，而不是 data/ 的正式資料，
// 這樣正式資料增減時測試結果不會跟著變。正式資料的內容由 tests/data.spec.ts 檢查。
vi.mock('@/data/loader', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/loader')>()
  const fixtures: DatasetModules = import.meta.glob('/tests/fixtures/data/**/*.json', {
    import: 'default',
  })
  const modules = Object.fromEntries(
    Object.entries(fixtures).map(([path, load]) => [path.replace('/tests/fixtures', ''), load]),
  )
  return {
    ...actual,
    loadDatasets: (m: DatasetModules = modules) => actual.loadDatasets(m),
  }
})

// jsdom 沒有 Service Worker；PWA 的註冊模組換成可控制的假物件
export const pwaState = {
  offlineReady: ref(false),
  needRefresh: ref(false),
  updateServiceWorker: vi.fn(),
}
vi.mock('virtual:pwa-register/vue', () => ({ useRegisterSW: () => pwaState }))

beforeEach(() => {
  // store 會從 localStorage 讀取已存的選取與設定，每個測驗前清空以免互相影響
  localStorage.clear()
  pwaState.offlineReady.value = false
  pwaState.needRefresh.value = false
  pwaState.updateServiceWorker.mockClear()
})
