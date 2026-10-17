export const CATEGORIES = ['vocabulary', 'grammar'] as const
export type Category = (typeof CATEGORIES)[number]

// 由易到難排序
export const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const
export type Level = (typeof LEVELS)[number]

export const CATEGORY_LABELS: Record<Category, string> = {
  vocabulary: '單字',
  grammar: '文法',
}

export interface VocabularyItem {
  id: string
  /** 漢字寫法；沒有漢字的詞直接填日文原文（例如 コーヒー） */
  japanese: string
  /** 讀音；沒有時以 japanese 代替 */
  hiragana?: string
  /** 簡短中文意思（繁體） */
  simple_chinese: string
  /** 完整解釋，支援 Markdown */
  full_explanation?: string
}

export interface GrammarExample {
  /** 例句，文法部分用【】標記，例如：若い【うちに】勉強しなさい。 */
  sentence: string
  /** 例句的中文翻譯 */
  translation?: string
}

export interface GrammarItem {
  id: string
  japanese: string
  simple_chinese: string
  full_explanation?: string
  examples?: GrammarExample[]
}

interface DatasetFileBase {
  name: string
  level: Level
  /** 系列名稱，例如「N3 單字（tanos）」；同系列拆成多個檔案時可在首頁一起篩選 */
  series?: string
  /** 資料來源與授權說明 */
  source?: string
}

export interface VocabularyDatasetFile extends DatasetFileBase {
  category: 'vocabulary'
  data: VocabularyItem[]
}

export interface GrammarDatasetFile extends DatasetFileBase {
  category: 'grammar'
  data: GrammarItem[]
}

/** data/ 目錄中 JSON 檔的格式 */
export type DatasetFile = VocabularyDatasetFile | GrammarDatasetFile

/** 載入後的資料集；id 由檔案路徑產生，例如 vocabulary/n3-business */
export type Dataset = DatasetFile & { id: string }

export interface DatasetLoadError {
  path: string
  errors: string[]
}
