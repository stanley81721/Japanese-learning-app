<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'

import AnswerMethodPicker from '@/components/AnswerMethodPicker.vue'
import { backupFileName, createBackup, downloadJSON, parseBackup } from '@/lib/backup'
import { useDatasetsStore } from '@/stores/datasets'
import { useProgressStore } from '@/stores/progress'
import { THEMES, useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
const progress = useProgressStore()
const datasetsStore = useDatasetsStore()
const { newCardsPerDay, theme } = storeToRefs(settings)
const { datasets } = storeToRefs(datasetsStore)

/** 操作結果訊息 */
const message = ref<{ kind: 'success' | 'error'; text: string } | null>(null)
const fileInput = ref<HTMLInputElement>()

/** 每份資料集有幾張卡有學習紀錄 */
const datasetsWithProgress = computed(() => {
  const keys = Object.keys(progress.cards)
  return datasets.value
    .map((d) => ({ dataset: d, count: keys.filter((k) => k.startsWith(`${d.id}:`)).length }))
    .filter((row) => row.count > 0)
})

function onNewLimitChange(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  if (Number.isInteger(value) && value >= 0 && value <= 999) newCardsPerDay.value = value
}

function exportBackup() {
  downloadJSON(
    backupFileName(),
    createBackup(progress.cards, progress.history, settings.snapshot()),
  )
  message.value = { kind: 'success', text: `已匯出 ${progress.totalCards} 張卡的學習進度。` }
}

async function onImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // 讓同一個檔案可以再選一次
  if (!file) return

  const result = parseBackup(await file.text())
  if (!result.ok) {
    message.value = { kind: 'error', text: `匯入失敗：${result.error}` }
    return
  }

  const count = Object.keys(result.backup.cards).length
  const ok = window.confirm(
    `要用備份檔（${count} 張卡）取代目前這個瀏覽器中的學習進度嗎？\n目前的進度會被覆蓋，建議先匯出備份。`,
  )
  if (!ok) return

  progress.replaceAll(result.backup.cards, result.backup.history)
  if (result.backup.settings !== undefined) settings.restore(result.backup.settings)
  message.value = { kind: 'success', text: `已匯入 ${count} 張卡的學習進度。` }
}

function resetDataset(id: string, name: string) {
  if (!window.confirm(`確定要清除「${name}」的學習進度嗎？此動作無法復原。`)) return
  progress.resetDataset(id)
  message.value = { kind: 'success', text: `已清除「${name}」的學習進度。` }
}

function resetAll() {
  if (!window.confirm('確定要清除所有學習進度與統計嗎？此動作無法復原，建議先匯出備份。')) return
  progress.resetAll()
  message.value = { kind: 'success', text: '已清除所有學習進度。' }
}

onMounted(() => datasetsStore.ensureLoaded())
</script>

<template>
  <section class="settings">
    <h1>設定</h1>

    <p
      v-if="message"
      class="message"
      :class="message.kind"
      :role="message.kind === 'error' ? 'alert' : 'status'"
    >
      {{ message.text }}
    </p>

    <div class="panel">
      <h2>學習</h2>
      <label class="row">
        每日新卡上限
        <input
          type="number"
          class="number-input"
          min="0"
          max="999"
          :value="newCardsPerDay"
          @change="onNewLimitChange"
        />
      </label>
      <AnswerMethodPicker />
    </div>

    <div class="panel">
      <h2>外觀</h2>
      <fieldset class="option-group">
        <legend>主題</legend>
        <label v-for="t in THEMES" :key="t.id" class="option">
          <input v-model="theme" type="radio" name="theme" :value="t.id" />
          {{ t.label }}
        </label>
      </fieldset>
    </div>

    <div class="panel">
      <h2>備份</h2>
      <p class="muted small">
        學習進度只存在這個瀏覽器中。清除瀏覽器資料或換裝置前，請先匯出備份檔。
      </p>
      <div class="actions">
        <button type="button" class="btn" @click="exportBackup">匯出備份</button>
        <button type="button" class="btn" @click="fileInput?.click()">匯入備份…</button>
        <input
          ref="fileInput"
          type="file"
          accept="application/json,.json"
          class="visually-hidden"
          aria-label="選擇備份檔"
          @change="onImportFile"
        />
      </div>
      <p class="muted small">目前共有 {{ progress.totalCards }} 張卡有學習紀錄。</p>
    </div>

    <div class="panel">
      <h2>重置</h2>
      <ul v-if="datasetsWithProgress.length" class="reset-list">
        <li v-for="{ dataset, count } in datasetsWithProgress" :key="dataset.id">
          <span
            >{{ dataset.name }}<span class="muted small">（{{ count }} 張卡）</span></span
          >
          <button
            type="button"
            class="btn btn-small"
            @click="resetDataset(dataset.id, dataset.name)"
          >
            清除進度
          </button>
        </li>
      </ul>
      <p v-else class="muted small">還沒有任何學習紀錄。</p>
      <div class="actions">
        <button type="button" class="btn btn-danger" @click="resetAll">清除所有進度</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.settings {
  max-width: 640px;
  margin: 0 auto;
}

h1 {
  margin-top: 0;
}

.muted {
  color: var(--color-text-muted);
}

.small {
  font-size: 0.875rem;
}

.message {
  padding: 0.75rem 1rem;
  border: 1px solid;
  border-radius: var(--radius);
  font-size: 0.875rem;
}

.message.success {
  border-color: var(--color-success);
  color: var(--color-success);
}

.message.error {
  border-color: var(--color-danger);
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.number-input {
  width: 5rem;
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin: 0.75rem 0;
}

.btn-small {
  padding: 0.25rem 0.75rem;
  font-size: 0.875rem;
}

.reset-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.reset-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.5rem 0;
}

.reset-list li + li {
  border-top: 1px solid var(--color-border);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
