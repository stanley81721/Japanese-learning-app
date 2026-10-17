<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watchEffect } from 'vue'
import { RouterLink, RouterView } from 'vue-router'

import ShortcutsDialog from '@/components/ShortcutsDialog.vue'
import UpdatePrompt from '@/components/UpdatePrompt.vue'
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

const mainEl = ref<HTMLElement>()

// 按 ? 開關快捷鍵說明（輸入框中不攔截）
const showShortcuts = ref(false)
function onKeydown(event: KeyboardEvent) {
  const target = event.target instanceof Element ? event.target : null
  if (event.key !== '?' || target?.closest('input, textarea, select')) return
  event.preventDefault()
  showShortcuts.value = !showShortcuts.value
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <a href="#main" class="skip-link" @click.prevent="mainEl?.focus()"> 跳到主要內容 </a>

  <header class="app-header">
    <RouterLink to="/" class="brand">日文單字卡</RouterLink>
    <nav class="app-nav" aria-label="主選單">
      <RouterLink v-for="item in navItems" :key="item.to" :to="item.to">
        {{ item.label }}
      </RouterLink>
    </nav>
    <button
      type="button"
      class="shortcuts-button"
      aria-label="鍵盤快捷鍵"
      title="鍵盤快捷鍵（?）"
      @click="showShortcuts = true"
    >
      ?
    </button>
  </header>

  <main id="main" ref="mainEl" class="app-main" tabindex="-1">
    <RouterView />
  </main>

  <ShortcutsDialog v-model="showShortcuts" />
  <UpdatePrompt />
</template>

<style scoped>
.app-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.brand {
  margin-right: auto;
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

.shortcuts-button {
  width: 2rem;
  height: 2rem;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  background: none;
  color: var(--color-text-muted);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.shortcuts-button:hover {
  background: var(--color-hover);
}

.app-main {
  max-width: 960px;
  margin: 0 auto;
  padding: 1.5rem 1rem;
}

.app-main:focus {
  outline: none;
}

/* 手機：導覽只佔一列。「首頁」連結與品牌名稱功能相同，所以隱藏品牌；
   快捷鍵按鈕在觸控裝置上用不到也一併隱藏 */
@media (max-width: 560px) {
  .app-header {
    padding: 0.5rem;
  }

  .brand,
  .shortcuts-button {
    display: none;
  }

  .app-nav {
    flex: 1;
    flex-wrap: nowrap;
    justify-content: space-between;
  }

  .app-nav a {
    padding: 0.5rem 0.625rem;
  }

  .app-main {
    padding: 1rem 0.75rem;
  }
}
</style>
