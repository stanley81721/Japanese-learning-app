import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

import { loadDatasets, type DatasetModules } from '@/data/loader'
import { loadJSON, saveJSON } from '@/lib/storage'
import type { Category, Dataset, DatasetLoadError, Level } from '@/types/dataset'

export type CategoryFilter = Category | 'all'
export type LevelFilter = Level | 'all'

/** 沒有設定 series 的資料集在系列篩選中的代表值 */
export const NO_SERIES = ''
export const seriesOf = (d: Dataset): string => d.series ?? NO_SERIES

export const useDatasetsStore = defineStore('datasets', () => {
  const datasets = ref<Dataset[]>([])
  const loadErrors = ref<DatasetLoadError[]>([])
  const status = ref<'idle' | 'loading' | 'ready'>('idle')

  const categoryFilter = ref<CategoryFilter>('all')
  const levelFilter = ref<LevelFilter>('all')
  const seriesFilter = ref<string>('all')
  // 選取的資料集記在瀏覽器裡，重新整理或直接開啟 #/study 時仍保留
  const selectedIds = ref<string[]>(loadJSON<string[]>('selected-datasets', []))
  watch(selectedIds, (ids) => saveJSON('selected-datasets', ids))

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

  const matchesCategoryAndLevel = (d: Dataset) =>
    (categoryFilter.value === 'all' || d.category === categoryFilter.value) &&
    (levelFilter.value === 'all' || d.level === levelFilter.value)

  /** 目前分類與等級下有哪些系列；沒有 series 的資料集歸在 NO_SERIES */
  const seriesOptions = computed(() => {
    const names = new Set(datasets.value.filter(matchesCategoryAndLevel).map(seriesOf))
    return [...names].sort((a, b) =>
      a === NO_SERIES ? 1 : b === NO_SERIES ? -1 : a.localeCompare(b, 'ja'),
    )
  })

  // 換了分類或等級後，原本選的系列可能不存在了，就改回全部
  watch(seriesOptions, (options) => {
    if (seriesFilter.value !== 'all' && !options.includes(seriesFilter.value)) {
      seriesFilter.value = 'all'
    }
  })

  const filteredDatasets = computed(() =>
    datasets.value.filter(
      (d) =>
        matchesCategoryAndLevel(d) &&
        (seriesFilter.value === 'all' || seriesOf(d) === seriesFilter.value),
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
    seriesFilter,
    seriesOptions,
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
