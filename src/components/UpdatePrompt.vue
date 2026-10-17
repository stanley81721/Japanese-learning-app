<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue'

// Service Worker：第一次快取完成時提示可離線使用；有新版本時詢問是否重新載入
const { offlineReady, needRefresh, updateServiceWorker } = useRegisterSW()

function close() {
  offlineReady.value = false
  needRefresh.value = false
}
</script>

<template>
  <div v-if="offlineReady || needRefresh" class="toast" role="status">
    <span v-if="needRefresh">有新版本可以使用。</span>
    <span v-else>已完成下載，之後沒有網路也能使用。</span>
    <div class="toast-actions">
      <button
        v-if="needRefresh"
        type="button"
        class="btn btn-primary"
        @click="updateServiceWorker()"
      >
        重新載入
      </button>
      <button type="button" class="btn" @click="close">{{ needRefresh ? '稍後' : '好' }}</button>
    </div>
  </div>
</template>

<style scoped>
.toast {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 10;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;
  max-width: calc(100vw - 2rem);
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.15);
  font-size: 0.9375rem;
}

.toast-actions {
  display: flex;
  gap: 0.5rem;
}

.toast .btn {
  padding: 0.375rem 0.875rem;
}
</style>
