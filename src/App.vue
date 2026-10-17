<script setup lang="ts">
import { watchEffect } from 'vue'
import { RouterLink, RouterView } from 'vue-router'

import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()

// 主題：跟隨系統時移除 data-theme，交給 prefers-color-scheme 決定
watchEffect(() => {
  const root = document.documentElement
  if (settings.theme === 'system') delete root.dataset.theme
  else root.dataset.theme = settings.theme
})

const navItems = [
  { to: '/', label: '首頁' },
  { to: '/study', label: '學習' },
  { to: '/quiz', label: '測驗' },
  { to: '/browse', label: '瀏覽' },
  { to: '/stats', label: '統計' },
  { to: '/settings', label: '設定' },
]
</script>

<template>
  <header class="app-header">
    <RouterLink to="/" class="brand">日文單字卡</RouterLink>
    <nav class="app-nav" aria-label="主選單">
      <RouterLink v-for="item in navItems" :key="item.to" :to="item.to">
        {{ item.label }}
      </RouterLink>
    </nav>
  </header>

  <main class="app-main">
    <RouterView />
  </main>
</template>

<style scoped>
.app-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.brand {
  font-weight: 700;
  font-size: 1.125rem;
  color: var(--color-text);
  text-decoration: none;
}

.app-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.app-nav a {
  padding: 0.375rem 0.75rem;
  border-radius: var(--radius);
  color: var(--color-text-muted);
  text-decoration: none;
}

.app-nav a:hover {
  background: var(--color-hover);
}

.app-nav a.router-link-exact-active {
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-weight: 600;
}

.app-main {
  max-width: 960px;
  margin: 0 auto;
  padding: 1.5rem 1rem;
}
</style>
