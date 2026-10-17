// 驗證 data/ 中的 JSON。瀏覽器載入時與 scripts/validate-data.ts 共用，
// 所以這裡只用相對路徑匯入，不使用 @ 別名。
import { CATEGORIES, LEVELS, type DatasetFile } from '../types/dataset'

export type ValidationResult =
  { ok: true; dataset: DatasetFile; errors: [] } | { ok: false; errors: string[] }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== ''

/** 檢查例句的【】標記；正確時回傳 null，否則回傳錯誤說明 */
export function checkGrammarMarkup(sentence: string): string | null {
  let open = false
  let inner = ''
  let marks = 0
  for (const ch of sentence) {
    if (ch === '【') {
      if (open) return '【】不可巢狀'
      open = true
      inner = ''
    } else if (ch === '】') {
      if (!open) return '多出一個 】'
      if (inner.trim() === '') return '【】內不可為空'
      open = false
      marks++
    } else if (open) {
      inner += ch
    }
  }
  if (open) return '缺少對應的 】'
  if (marks === 0) return '沒有用【】標記文法'
  return null
}

function checkOptionalString(item: Record<string, unknown>, key: string, where: string): string[] {
  const value = item[key]
  if (value === undefined || typeof value === 'string') return []
  return [`${where}：${key} 必須是字串`]
}

function validateItem(
  item: unknown,
  index: number,
  category: DatasetFile['category'],
  seenIds: Set<string>,
): string[] {
  if (!isRecord(item)) return [`data[${index}]：必須是物件`]

  const where = isNonEmptyString(item.id) ? `data[${index}]（id: ${item.id}）` : `data[${index}]`
  const errors: string[] = []

  if (!isNonEmptyString(item.id)) {
    errors.push(`${where}：缺少 id`)
  } else if (seenIds.has(item.id)) {
    errors.push(`${where}：id 重複`)
  } else {
    seenIds.add(item.id)
  }

  if (!isNonEmptyString(item.japanese)) errors.push(`${where}：缺少 japanese`)
  if (!isNonEmptyString(item.simple_chinese)) errors.push(`${where}：缺少 simple_chinese`)
  errors.push(...checkOptionalString(item, 'full_explanation', where))

  if (category === 'vocabulary') {
    errors.push(...checkOptionalString(item, 'hiragana', where))
  } else if (item.examples !== undefined) {
    if (!Array.isArray(item.examples)) {
      errors.push(`${where}：examples 必須是陣列`)
    } else {
      item.examples.forEach((example: unknown, i) => {
        const exWhere = `${where} examples[${i}]`
        if (!isRecord(example)) {
          errors.push(`${exWhere}：必須是物件`)
          return
        }
        if (!isNonEmptyString(example.sentence)) {
          errors.push(`${exWhere}：缺少 sentence`)
        } else {
          const markupError = checkGrammarMarkup(example.sentence)
          if (markupError) errors.push(`${exWhere}：${markupError}`)
        }
        errors.push(...checkOptionalString(example, 'translation', exWhere))
      })
    }
  }

  return errors
}

export function validateDataset(raw: unknown): ValidationResult {
  if (!isRecord(raw)) return { ok: false, errors: ['檔案內容必須是 JSON 物件'] }

  const errors: string[] = []

  if (!isNonEmptyString(raw.name)) errors.push('缺少 name')

  const category = raw.category
  const validCategory = (CATEGORIES as readonly unknown[]).includes(category)
  if (!validCategory) errors.push(`category 必須是 ${CATEGORIES.join(' / ')}`)

  if (!(LEVELS as readonly unknown[]).includes(raw.level)) {
    errors.push(`level 必須是 ${LEVELS.join(' / ')}`)
  }

  if (!Array.isArray(raw.data)) {
    errors.push('data 必須是陣列')
  } else if (validCategory) {
    const seenIds = new Set<string>()
    raw.data.forEach((item: unknown, index) => {
      errors.push(...validateItem(item, index, category as DatasetFile['category'], seenIds))
    })
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, dataset: raw as unknown as DatasetFile, errors: [] }
}
