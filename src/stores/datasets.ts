import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { loadDatasets, type DatasetModules } from '@/data/loader'
import type { Category, Dataset, DatasetLoadError, Level } from '@/types/dataset'

export type CategoryFilter = Category | 'all'
export type LevelFilter = Level | 'all'

export const useDatasetsStore = defineStore('datasets', () => {
  const datasets = ref<Dataset[]>([])
  const loadErrors = ref<DatasetLoadError[]>([])
  const status = ref<'idle' | 'loading' | 'ready'>('idle')

  const categoryFilter = ref<CategoryFilter>('all')
  const levelFilter = ref<LevelFilter>('all')
  const selectedIds = ref<string[]>([])

  let pending: Promise<void> | null = null

  /** 載入 data/ 中所有資料集；重複呼叫只會載入一次 */
  function ensureLoaded(modules?: DatasetModules): Promise<void> {
    if (!pending) {
      status.value = 'loading'
      pending = loadDatasets(modules).then((result) => {
        datasets.value = result.datasets
        loadErrors.value = result.errors
        status.value = 'ready'
        for (const error of result.errors) {
          console.warn(`[datasets] ${error.path}\n  ${error.errors.join('\n  ')}`)
        }
      })
    }
    return pending
  }

  const filteredDatasets = computed(() =>
    datasets.value.filter(
      (d) =>
        (categoryFilter.value === 'all' || d.category === categoryFilter.value) &&
        (levelFilter.value === 'all' || d.level === levelFilter.value),
    ),
  )

  const selectedDatasets = computed(() =>
    datasets.value.filter((d) => selectedIds.value.includes(d.id)),
  )

  const selectedItemCount = computed(() =>
    selectedDatasets.value.reduce((sum, d) => sum + d.data.length, 0),
  )

  function isSelected(id: string): boolean {
    return selectedIds.value.includes(id)
  }

  function toggleSelected(id: string): void {
    selectedIds.value = isSelected(id)
      ? selectedIds.value.filter((x) => x !== id)
      : [...selectedIds.value, id]
  }

  /** 把目前篩選結果全部加入選取 */
  function selectFiltered(): void {
    const ids = new Set(selectedIds.value)
    for (const d of filteredDatasets.value) ids.add(d.id)
    selectedIds.value = [...ids]
  }

  function clearSelection(): void {
    selectedIds.value = []
  }

  return {
    datasets,
    loadErrors,
    status,
    categoryFilter,
    levelFilter,
    selectedIds,
    filteredDatasets,
    selectedDatasets,
    selectedItemCount,
    ensureLoaded,
    isSelected,
    toggleSelected,
    selectFiltered,
    clearSelection,
  }
})
