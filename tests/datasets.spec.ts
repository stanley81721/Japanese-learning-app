import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { datasetIdFromPath, loadDatasets, type DatasetModules } from '@/data/loader'
import { useDatasetsStore } from '@/stores/datasets'

const item = (id: string) => ({ id, japanese: '語', simple_chinese: '詞' })

const modules: DatasetModules = {
  '/data/vocabulary/n3-b.json': async () => ({
    name: 'B 單字',
    category: 'vocabulary',
    level: 'N3',
    data: [item('1'), item('2')],
  }),
  '/data/vocabulary/n4-a.json': async () => ({
    name: 'A 單字',
    category: 'vocabulary',
    level: 'N4',
    data: [item('1')],
  }),
  '/data/grammar/n3.json': async () => ({
    name: '文法',
    category: 'grammar',
    level: 'N3',
    data: [item('1'), item('2'), item('3')],
  }),
  '/data/broken.json': async () => ({
    name: '壞掉',
    category: 'vocabulary',
    level: 'N9',
    data: [],
  }),
}

describe('loader', () => {
  it('derives dataset ids from file paths', () => {
    expect(datasetIdFromPath('/data/vocabulary/n3-business.json')).toBe('vocabulary/n3-business')
  })

  it('loads valid datasets sorted by category, level, then name, and reports invalid ones', async () => {
    const { datasets, errors } = await loadDatasets(modules)
    expect(datasets.map((d) => d.id)).toEqual(['grammar/n3', 'vocabulary/n4-a', 'vocabulary/n3-b'])
    expect(errors).toEqual([
      { path: '/data/broken.json', errors: [expect.stringContaining('level')] },
    ])
  })

  it('reports files that fail to load', async () => {
    const { errors } = await loadDatasets({
      '/data/x.json': () => Promise.reject(new Error('boom')),
    })
    expect(errors[0]?.errors[0]).toContain('boom')
  })
})

describe('datasets store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('loads only once', async () => {
    const store = useDatasetsStore()
    const load = vi.fn(async () => ({ name: 'X', category: 'grammar', level: 'N5', data: [] }))
    await Promise.all([
      store.ensureLoaded({ '/data/x.json': load }),
      store.ensureLoaded({ '/data/x.json': load }),
    ])
    await store.ensureLoaded()
    expect(load).toHaveBeenCalledTimes(1)
    expect(store.status).toBe('ready')
  })

  it('filters by category and level', async () => {
    const store = useDatasetsStore()
    await store.ensureLoaded(modules)
    expect(store.filteredDatasets).toHaveLength(3)

    store.categoryFilter = 'vocabulary'
    expect(store.filteredDatasets.map((d) => d.id)).toEqual(['vocabulary/n4-a', 'vocabulary/n3-b'])

    store.levelFilter = 'N3'
    expect(store.filteredDatasets.map((d) => d.id)).toEqual(['vocabulary/n3-b'])

    store.categoryFilter = 'all'
    expect(store.filteredDatasets.map((d) => d.id)).toEqual(['grammar/n3', 'vocabulary/n3-b'])
  })

  it('selects datasets across filters and counts their items', async () => {
    const store = useDatasetsStore()
    await store.ensureLoaded(modules)

    store.toggleSelected('grammar/n3')
    store.levelFilter = 'N3'
    store.selectFiltered()
    expect(store.selectedDatasets.map((d) => d.id)).toEqual(['grammar/n3', 'vocabulary/n3-b'])
    expect(store.selectedItemCount).toBe(5)

    store.toggleSelected('grammar/n3')
    expect(store.isSelected('grammar/n3')).toBe(false)
    expect(store.selectedItemCount).toBe(2)

    store.clearSelection()
    expect(store.selectedDatasets).toEqual([])
  })
})
