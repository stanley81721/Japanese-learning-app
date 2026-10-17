// 檢查 data/ 下所有 JSON 資料集；有錯誤時以 exit code 1 結束（建置與 CI 會因此失敗）
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { validateDataset } from '../src/lib/validateDataset'

const root = fileURLToPath(new URL('..', import.meta.url))
const dataDir = join(root, 'data')

function listJsonFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return listJsonFiles(path)
    return entry.name.endsWith('.json') ? [path] : []
  })
}

const files = listJsonFiles(dataDir).sort()
let failed = 0
let items = 0

for (const file of files) {
  const name = relative(root, file).replaceAll('\\', '/')
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    console.error(`✗ ${name}\n  JSON 格式錯誤：${(error as Error).message}`)
    failed++
    continue
  }

  const result = validateDataset(raw)
  if (result.ok) {
    items += result.dataset.data.length
    console.log(`✓ ${name}（${result.dataset.data.length} 筆）`)
  } else {
    console.error(`✗ ${name}\n  ${result.errors.join('\n  ')}`)
    failed++
  }
}

console.log(`\n共 ${files.length} 個檔案、${items} 筆資料；${failed} 個檔案有錯誤。`)
process.exit(failed > 0 ? 1 : 0)
