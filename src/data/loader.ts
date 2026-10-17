import { LEVELS, type Dataset, type DatasetLoadError } from '@/types/dataset'
import { validateDataset } from '@/lib/validateDataset'

export type DatasetModules = Record<string, () => Promise<unknown>>

// 每個 JSON 檔各自打包成一個 chunk，啟動時並行載入
const dataModules: DatasetModules = import.meta.glob('/data/**/*.json', { import: 'default' })

/** /data/vocabulary/n3-business.json → vocabulary/n3-business */
export function datasetIdFromPath(path: string): string {
  return path.replace(/^\/?data\//, '').replace(/\.json$/, '')
}

export function compareDatasets(a: Dataset, b: Dataset): number {
  return (
    a.category.localeCompare(b.category) ||
    LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) ||
    a.name.localeCompare(b.name, 'ja')
  )
}

export async function loadDatasets(
  modules: DatasetModules = dataModules,
): Promise<{ datasets: Dataset[]; errors: DatasetLoadError[] }> {
  const datasets: Dataset[] = []
  const errors: DatasetLoadError[] = []

  await Promise.all(
    Object.entries(modules).map(async ([path, load]) => {
      let raw: unknown
      try {
        raw = await load()
      } catch (error) {
        errors.push({ path, errors: [`無法載入：${String(error)}`] })
        return
      }
      const result = validateDataset(raw)
      if (result.ok) {
        datasets.push({ ...result.dataset, id: datasetIdFromPath(path) })
      } else {
        errors.push({ path, errors: result.errors })
      }
    }),
  )

  datasets.sort(compareDatasets)
  errors.sort((a, b) => a.path.localeCompare(b.path))
  return { datasets, errors }
}
