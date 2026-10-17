<script setup lang="ts">
import { useSpeechStore } from '@/stores/speech'

const props = defineProps<{
  text: string
  /** 顯示在按鈕旁的快捷鍵提示 */
  shortcut?: string
}>()

const speech = useSpeechStore()

function onClick(event: MouseEvent) {
  // 放在可點擊的列或卡片裡時，不要觸發外層的點擊
  event.stopPropagation()
  speech.speak(props.text)
}
</script>

<template>
  <button
    v-if="speech.available"
    type="button"
    class="speak-button"
    :aria-label="`朗讀：${text}`"
    :title="shortcut ? `朗讀（${shortcut}）` : '朗讀'"
    @click="onClick"
  >
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"
        fill="currentColor"
      />
    </svg>
    <kbd v-if="shortcut">{{ shortcut }}</kbd>
  </button>
</template>

<style scoped>
.speak-button {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.375rem;
  border: 1px solid transparent;
  border-radius: 6px;
  background: none;
  color: var(--color-text-muted);
  font: inherit;
  font-size: 0.75rem;
  cursor: pointer;
}

.speak-button:hover {
  border-color: var(--color-border);
  background: var(--color-hover);
  color: var(--color-primary);
}
</style>
