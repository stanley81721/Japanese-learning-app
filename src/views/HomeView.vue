<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'

import FilterChips from '@/components/FilterChips.vue'
import { useDatasetsStore, type CategoryFilter, type LevelFilter } from '@/stores/datasets'
import { CATEGORIES, CATEGORY_LABELS, LEVELS } from '@/types/dataset'

const store = useDatasetsStore()
const {
  status,
  loadErrors,
  categoryFilter,
  levelFilter,
  filteredDatasets,
  selectedDatasets,
  selectedItemCount,
} = storeToRefs(store)

const categoryOptions: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  ...CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] })),
]

const levelOptions: { value: LevelFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  ...LEVELS.map((l) => ({ value: l, label: l })),
]

onMounted(() => store.ensureLoaded())
</script>

<template>
  <section>
    <h1>選擇資料集</h1>

    <div class="filters">
      <FilterChips v-model="categoryFilter" label="分類" :options="categoryOptions" />
      <FilterChips v-model="levelFilter" label="等級" :options="levelOptions" />
    </div>

    <p v-if="status !== 'ready'" class="muted">載入中…</p>

    <template v-else>
      <div v-if="loadErrors.length" class="load-errors" role="alert">
        <strong>有 {{ loadErrors.length }} 個資料集格式錯誤，已略過：</strong>
        <ul>
          <li v-for="error in loadErrors" :key="error.path">
            <code>{{ error.path }}</code>：{{ error.errors[0] }}
            <span v-if="error.errors.length > 1">（另有 {{ error.errors.length - 1 }} 個錯誤）</span>
          </li>
        </ul>
      </div>

      <div class="list-actions">
        <span class="muted">{{ filteredDatasets.length }} 份資料集</span>
        <button
          type="button"
          class="link-button"
          :disabled="filteredDatasets.length === 0"
          @click="store.selectFiltered()"
        >
          全選
        </button>
      </div>

      <p v-if="filteredDatasets.length === 0" class="muted empty">沒有符合條件的資料集。</p>

      <ul v-else class="dataset-list">
        <li v-for="dataset in filteredDatasets" :key="dataset.id">
          <label class="dataset-card" :class="{ selected: store.isSelected(dataset.id) }">
            <input
              type="checkbox"
              :checked="store.isSelected(dataset.id)"
              @change="store.toggleSelected(dataset.id)"
            />
            <span class="dataset-name">{{ dataset.name }}</span>
            <span class="dataset-meta">
              <span class="badge" :class="dataset.category">
                {{ CATEGORY_LABELS[dataset.category] }}
              </span>
              <span class="badge level">{{ dataset.level }}</span>
              <span class="muted">{{ dataset.data.length }} 筆</span>
            </span>
          </label>
        </li>
      </ul>
    </template>

    <div class="selection-bar">
      <span v-if="selectedDatasets.length">
        已選 {{ selectedDatasets.length }} 份，共 {{ selectedItemCount }} 筆
      </span>
      <span v-else class="muted">尚未選擇資料集</span>
      <span class="selection-actions">
        <button
          v-if="selectedDatasets.length"
          type="button"
          class="link-button"
          @click="store.clearSelection()"
        >
          清除
        </button>
        <RouterLink
          to="/study"
          class="primary-button"
          :class="{ disabled: !selectedDatasets.length }"
          :aria-disabled="!selectedDatasets.length"
          :tabindex="selectedDatasets.length ? undefined : -1"
          @click="(e: MouseEvent) => !selectedDatasets.length && e.preventDefault()"
        >
          開始學習
        </RouterLink>
      </span>
    </div>
  </section>
</template>

<style scoped>
h1 {
  margin-top: 0;
}

.filters {
  display: grid;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}

.muted {
  color: var(--color-text-muted);
}

.empty {
  padding: 2rem 0;
  text-align: center;
}

.load-errors {
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-danger);
  border-radius: var(--radius);
  background: var(--color-danger-soft);
  font-size: 0.875rem;
}

.load-errors ul {
  margin: 0.25rem 0 0;
  padding-left: 1.25rem;
}

.list-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.dataset-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 0.75rem;
  margin: 0 0 6rem;
  padding: 0;
  list-style: none;
}

.dataset-card {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.25rem 0.75rem;
  align-items: center;
  height: 100%;
  padding: 0.875rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  cursor: pointer;
}

.dataset-card:hover {
  border-color: var(--color-primary);
}

.dataset-card.selected {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary);
}

.dataset-card input {
  width: 1.125rem;
  height: 1.125rem;
  accent-color: var(--color-primary);
}

.dataset-name {
  font-weight: 600;
}

.dataset-meta {
  grid-column: 2;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
}

.badge {
  padding: 0 0.5rem;
  border-radius: 4px;
  background: var(--color-hover);
  font-weight: 600;
}

.badge.vocabulary {
  background: var(--color-vocab-soft);
  color: var(--color-vocab);
}

.badge.grammar {
  background: var(--color-grammar-soft);
  color: var(--color-grammar);
}

.selection-bar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  padding: 0.75rem max(1rem, calc((100vw - 960px) / 2 + 1rem));
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
}

.selection-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.link-button {
  padding: 0;
  border: none;
  background: none;
  color: var(--color-primary);
  font: inherit;
  cursor: pointer;
}

.link-button:disabled {
  color: var(--color-text-muted);
  cursor: default;
}

.primary-button {
  padding: 0.5rem 1.25rem;
  border-radius: var(--radius);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-weight: 600;
  text-decoration: none;
}

.primary-button.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
