import { beforeEach } from 'vitest'

// store 會從 localStorage 讀取已存的選取與設定，每個測驗前清空以免互相影響
beforeEach(() => {
  localStorage.clear()
})
