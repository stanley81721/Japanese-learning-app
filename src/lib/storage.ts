// 瀏覽器儲存的薄包裝。localStorage 在私密模式或被封鎖時可能拋錯，所以一律 try/catch。
// M3 會在這裡加入學習進度、版本遷移與匯出匯入。

const PREFIX = 'jla:v1:'

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function saveJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // 空間不足或無法存取時忽略；進度功能（M3）會另外提示
  }
}
