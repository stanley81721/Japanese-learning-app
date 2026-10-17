import type { Category, Dataset, GrammarItem, VocabularyItem } from '@/types/dataset'

export type QuizModeId =
  | 'vocab-kanji-to-zh'
  | 'vocab-kana-to-zh'
  | 'vocab-zh-to-jp'
  | 'grammar-pattern-to-zh'
  | 'grammar-zh-to-pattern'

export interface QuizMode {
  id: QuizModeId
  category: Category
  label: string
}

// 例句高亮與挖空模式在 M5 加入
export const QUIZ_MODES: readonly QuizMode[] = [
  { id: 'vocab-kanji-to-zh', category: 'vocabulary', label: '漢字 → 中文' },
  { id: 'vocab-kana-to-zh', category: 'vocabulary', label: '假名 → 中文' },
  { id: 'vocab-zh-to-jp', category: 'vocabulary', label: '中文 → 日文' },
  { id: 'grammar-pattern-to-zh', category: 'grammar', label: '文法 → 中文' },
  { id: 'grammar-zh-to-pattern', category: 'grammar', label: '中文 → 文法' },
]

export const QUIZ_MODE_IDS = QUIZ_MODES.map((m) => m.id)

export function getQuizMode(id: QuizModeId): QuizMode {
  return QUIZ_MODES.find((m) => m.id === id)!
}

export interface CardText {
  text: string
  lang: 'ja' | 'zh'
}

export interface CardFace extends CardText {
  /** 主答案下方的補充，例如漢字＋讀音 */
  sub?: CardText
  /** 完整解釋（Markdown） */
  explanation?: string
}

export interface StudyCard {
  /** 進度鍵：資料集ID:項目ID:模式ID */
  key: string
  datasetId: string
  datasetName: string
  itemId: string
  modeId: QuizModeId
  front: CardFace
  back: CardFace
}

const ja = (text: string): CardText => ({ text, lang: 'ja' })
const zh = (text: string): CardText => ({ text, lang: 'zh' })

/** 讀音與寫法不同時才回傳（沒有漢字的詞不重複顯示） */
function readingOf(item: VocabularyItem): string | undefined {
  const reading = item.hiragana?.trim()
  return reading && reading !== item.japanese ? reading : undefined
}

function fullJapanese(item: VocabularyItem): string {
  const reading = readingOf(item)
  return reading ? `${item.japanese}（${reading}）` : item.japanese
}

function faces(
  modeId: QuizModeId,
  item: VocabularyItem | GrammarItem,
): Pick<StudyCard, 'front' | 'back'> {
  const explanation = item.full_explanation
  switch (modeId) {
    case 'vocab-kanji-to-zh': {
      const v = item as VocabularyItem
      return {
        front: ja(v.japanese),
        back: { ...zh(v.simple_chinese), sub: ja(fullJapanese(v)), explanation },
      }
    }
    case 'vocab-kana-to-zh': {
      const v = item as VocabularyItem
      return {
        front: ja(v.hiragana?.trim() || v.japanese),
        back: { ...zh(v.simple_chinese), sub: ja(fullJapanese(v)), explanation },
      }
    }
    case 'vocab-zh-to-jp': {
      const v = item as VocabularyItem
      const reading = readingOf(v)
      return {
        front: zh(v.simple_chinese),
        back: { ...ja(v.japanese), sub: reading ? ja(reading) : undefined, explanation },
      }
    }
    case 'grammar-pattern-to-zh':
      return {
        front: ja(item.japanese),
        back: { ...zh(item.simple_chinese), sub: ja(item.japanese), explanation },
      }
    case 'grammar-zh-to-pattern':
      return {
        front: zh(item.simple_chinese),
        back: { ...ja(item.japanese), explanation },
      }
  }
}

export function buildCard(
  dataset: Dataset,
  item: VocabularyItem | GrammarItem,
  modeId: QuizModeId,
): StudyCard {
  return {
    key: `${dataset.id}:${item.id}:${modeId}`,
    datasetId: dataset.id,
    datasetName: dataset.name,
    itemId: item.id,
    modeId,
    ...faces(modeId, item),
  }
}
