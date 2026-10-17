import { beforeEach, vi } from 'vitest'
import { ref } from 'vue'

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
