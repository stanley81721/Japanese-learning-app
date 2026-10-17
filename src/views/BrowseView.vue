<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'

import MarkdownContent from '@/components/MarkdownContent.vue'
import MarkedSentence from '@/components/MarkedSentence.vue'
import SpeakButton from '@/components/SpeakButton.vue'
import { stripMarkup } from '@/lib/grammarMarkup'
import { useDatasetsStore } from '@/stores/datasets'
import { CATEGORY_LABELS, type GrammarItem, type VocabularyItem } from '@/types/dataset'

type Item = VocabularyItem | GrammarItem

const store = useDatasetsStore()
const { status, datasets, selectedDatasets } = storeToRefs(store)

const query = ref('')
// 有選資料集時預設只看已選的
const onlySelected = ref(true)
const expanded = ref<Set<string>>(new Set())

const sourceDatasets = computed(() =>
  onlySelected.value && selectedDatasets.value.length ? selectedDatasets.value : datasets.value,
)

function matches(item: Item, q: string): boolean {
  const fields = [item.japanese, item.simple_chinese, 'hiragana' in item ? item.hiragana : '']
  return fields.some((f) => f?.toLowerCase().includes(q))
}

const sections = computed(() => {
  const q = query.value.trim().toLowerCase()
  return sourceDatasets.value
    .map((dataset) => ({
      dataset,
      items: (dataset.data as Item[]).filter((item) => !q || matches(item, q)),
    }))
    .filter((section) => section.items.length > 0)
})

const resultCount = computed(() => sections.value.reduce((sum, s) => sum + s.items.length, 0))

function rowKey(datasetId: string, itemId: string) {
  return `${datasetId}:${itemId}`
}

function toggle(key: string) {
  const next = new Set(expanded.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expanded.value = next
}

function readingOf(item: Item): string | undefined {
  const reading = 'hiragana' in item ? item.hiragana?.trim() : undefined
  return reading && reading !== item.japanese ? reading : undefined
}

/** 單字念讀音，文法念原形（去掉～） */
function speechOf(item: Item): string {
  if ('hiragana' in item && item.hiragana?.trim()) return item.hiragana.trim()
  return item.japanese.replace(/[～〜]/g, '')
}

function hasDetails(item: Item): boolean {
  return Boolean(item.full_explanation || ('examples' in item && item.examples?.length))
}

onMounted(() => store.ensureLoaded())
</script>

<template>
  <section>
    <h1>瀏覽</h1>

    <div class="toolbar">
      <input
        v-model="query"
        type="search"
        class="search"
        placeholder="搜尋日文、讀音或中文"
        aria-label="搜尋"
      />
      <label v-if="selectedDatasets.length" class="only-selected">
        <input v-model="onlySelected" type="checkbox" />
        只看已選資料集
      </label>
    </div>

    <p v-if="status !== 'ready'" class="muted">載入中…</p>
    <p v-else-if="resultCount === 0" class="muted empty">找不到符合的項目。</p>

    <template v-else>
      <p class="muted small">{{ resultCount }} 筆</p>
      <section v-for="{ dataset, items } in sections" :key="dataset.id" class="dataset-section">
        <h2>
          {{ dataset.name }}
          <span class="muted small"
            >{{ CATEGORY_LABELS[dataset.category] }}・{{ dataset.level }}</span
          >
        </h2>
        <ul class="item-list">
          <li v-for="item in items" :key="item.id" class="item">
            <div class="item-head">
              <button
                type="button"
                class="item-row"
                :aria-expanded="
                  hasDetails(item) ? expanded.has(rowKey(dataset.id, item.id)) : undefined
                "
                :disabled="!hasDetails(item)"
                @click="toggle(rowKey(dataset.id, item.id))"
              >
                <span class="jp" lang="ja">{{ item.japanese }}</span>
                <span class="reading" lang="ja">{{ readingOf(item) }}</span>
                <span class="zh">{{ item.simple_chinese }}</span>
                <span v-if="hasDetails(item)" class="chevron" aria-hidden="true">
                  {{ expanded.has(rowKey(dataset.id, item.id)) ? '▾' : '▸' }}
                </span>
              </button>
              <SpeakButton class="row-speak" :text="speechOf(item)" />
            </div>
            <div v-if="expanded.has(rowKey(dataset.id, item.id))" class="details">
              <MarkdownContent v-if="item.full_explanation" :source="item.full_explanation" />
              <ul v-if="'examples' in item && item.examples?.length" class="examples">
                <li v-for="(example, i) in item.examples" :key="i">
                  <MarkedSentence :sentence="example.sentence" />
                  <SpeakButton :text="stripMarkup(example.sentence)" />
                  <div v-if="example.translation" class="muted small">
                    {{ example.translation }}
                  </div>
                </li>
              </ul>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </section>
</template>

<style scoped>
h1 {
  margin-top: 0;
}

.muted {
  color: var(--color-text-muted);
}

.small {
  font-size: 0.875rem;
  font-weight: normal;
}

.empty {
  padding: 2rem 0;
  text-align: center;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;
  margin-bottom: 1rem;
}

.search {
  flex: 1 1 240px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
}

.only-selected {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
}

.dataset-section h2 {
  margin: 1.5rem 0 0.5rem;
  font-size: 1.0625rem;
}

.item-list {
  margin: 0;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  list-style: none;
}

.item + .item {
  border-top: 1px solid var(--color-border);
}

.item-head {
  display: flex;
  align-items: center;
}

.row-speak {
  margin-right: 0.5rem;
}

.item-row {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(6rem, 1fr) minmax(5rem, 1fr) 2fr 1rem;
  gap: 0.75rem;
  align-items: baseline;
  width: 100%;
  padding: 0.625rem 1rem;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.item-row:disabled {
  cursor: default;
}

.item-row:hover:not(:disabled) {
  background: var(--color-hover);
}

.jp {
  font-size: 1.125rem;
  font-weight: 600;
}

.reading {
  color: var(--color-text-muted);
}

.chevron {
  color: var(--color-text-muted);
}

.details {
  padding: 0 1rem 0.875rem;
}

.examples {
  margin: 0.75rem 0 0;
  padding-left: 1.25rem;
}

.examples li + li {
  margin-top: 0.5rem;
}

@media (max-width: 560px) {
  .item-row {
    grid-template-columns: 1fr 1rem;
    gap: 0.125rem 0.5rem;
  }

  .item-row .chevron {
    grid-column: 2;
    grid-row: 1;
  }

  .reading:empty {
    display: none;
  }
}
</style>
