// 瀏覽器儲存的薄包裝。localStorage 在私密模式或被封鎖時可能拋錯，所以一律 try/catch。

const PREFIX = 'jla:v1:'

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

/** 寫入成功回傳 true；空間不足或無法存取時回傳 false */
export function saveJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export interface Versioned<T> {
  version: number
  data: T
}

/**
 * 讀取帶版本號的資料。版本較舊時用 migrate 轉換；
 * 格式無法辨識時回傳 null，呼叫端應避免覆寫原資料。
 */
export function loadVersioned<T>(
  key: string,
  currentVersion: number,
  migrate: (data: unknown, fromVersion: number) => T | null = () => null,
): T | null | undefined {
  const stored = loadJSON<unknown>(key, undefined)
  if (stored === undefined) return undefined
  if (typeof stored !== 'object' || stored === null || !('version' in stored)) return null
  const { version, data } = stored as Versioned<unknown>
  if (version === currentVersion) return data as T
  if (typeof version === 'number' && version < currentVersion) return migrate(data, version)
  return null
}

export function saveVersioned(key: string, version: number, data: unknown): boolean {
  return saveJSON(key, { version, data } satisfies Versioned<unknown>)
}
