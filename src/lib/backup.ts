// 學習進度的匯出／匯入（JSON 備份檔）
import type { CardProgress, CardState } from './srs'

export const BACKUP_FORMAT = 'japanese-learning-app-backup'
export const BACKUP_VERSION = 1

export interface DayStatsLike {
  reviews: number
  again: number
  newCards: number
}

export interface Backup {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  cards: Record<string, CardProgress>
  history: Record<string, DayStatsLike>
  /** 設定（每日新卡數、作答方式、主題等），格式由 settings store 驗證 */
  settings?: unknown
}

export function createBackup(
  cards: Record<string, CardProgress>,
  history: Record<string, DayStatsLike>,
  settings: unknown,
  now: Date = new Date(),
): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    cards,
    history,
    settings,
  }
}

const STATES: readonly CardState[] = ['new', 'learning', 'review', 'relearning']
const NUMBER_FIELDS = ['ease', 'interval', 'step', 'due', 'reps', 'lapses', 'lastReviewed'] as const

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isCount = (v: unknown) => Number.isInteger(v) && (v as number) >= 0

function validCard(key: string, value: unknown): value is CardProgress {
  if (!isRecord(value) || value.key !== key) return false
  if (!STATES.includes(value.state as CardState)) return false
  return NUMBER_FIELDS.every((f) => typeof value[f] === 'number' && Number.isFinite(value[f]))
}

export type ParseResult = { ok: true; backup: Backup } | { ok: false; error: string }

/** 解析並驗證備份檔內容；任何一筆資料格式不對就整份拒絕，避免匯入一半 */
export function parseBackup(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: '檔案不是有效的 JSON。' }
  }
  if (!isRecord(raw) || raw.format !== BACKUP_FORMAT) {
    return { ok: false, error: '這不是本 App 匯出的備份檔。' }
  }
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION) {
    return { ok: false, error: '備份檔的版本比目前的 App 新，請先更新 App。' }
  }
  if (!isRecord(raw.cards) || !isRecord(raw.history)) {
    return { ok: false, error: '備份檔缺少學習進度資料。' }
  }

  for (const [key, value] of Object.entries(raw.cards)) {
    if (!validCard(key, value)) return { ok: false, error: `卡片進度格式錯誤：${key}` }
  }
  for (const [day, value] of Object.entries(raw.history)) {
    const valid =
      /^\d{4}-\d{2}-\d{2}$/.test(day) &&
      isRecord(value) &&
      isCount(value.reviews) &&
      isCount(value.again) &&
      isCount(value.newCards)
    if (!valid) return { ok: false, error: `每日統計格式錯誤：${day}` }
  }

  return { ok: true, backup: raw as unknown as Backup }
}

export function backupFileName(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  return `japanese-learning-backup-${date}.json`
}

/** 在瀏覽器下載 JSON 檔 */
export function downloadJSON(fileName: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
