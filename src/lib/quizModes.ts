import type {
  Category,
  Dataset,
  GrammarExample,
  GrammarItem,
  VocabularyItem,
} from '@/types/dataset'
import { parseMarkedSentence, stripMarkup } from './grammarMarkup'
import { pickRandom, type RandomFn } from './shuffle'

export type QuizModeId =
  | 'vocab-kanji-to-zh'
  | 'vocab-kana-to-zh'
  | 'vocab-zh-to-jp'
  | 'grammar-pattern-to-zh'
  | 'grammar-sentence-to-zh'
  | 'grammar-zh-to-pattern'
  | 'grammar-cloze'

export interface QuizMode {
  id: QuizModeId
  category: Category
  label: string
  /** 需要例句（examples）的模式；沒有例句的項目不會出這種題 */
  needsExamples?: boolean
}

export const QUIZ_MODES: readonly QuizMode[] = [
  { id: 'vocab-kanji-to-zh', category: 'vocabulary', label: '漢字 → 中文' },
  { id: 'vocab-kana-to-zh', category: 'vocabulary', label: '假名 → 中文' },
  { id: 'vocab-zh-to-jp', category: 'vocabulary', label: '中文 → 日文' },
  { id: 'grammar-pattern-to-zh', category: 'grammar', label: '文法 → 中文' },
  {
    id: 'grammar-sentence-to-zh',
    category: 'grammar',
    label: '例句 → 中文',
    needsExamples: true,
  },
  { id: 'grammar-zh-to-pattern', category: 'grammar', label: '中文 → 文法' },
  { id: 'grammar-cloze', category: 'grammar', label: '例句挖空 → 文法', needsExamples: true },
]

export const QUIZ_MODE_IDS = QUIZ_MODES.map((m) => m.id)

export function getQuizMode(id: QuizModeId): QuizMode {
  return QUIZ_MODES.find((m) => m.id === id)!
}

/** 這個項目能不能出這種題（例句模式需要至少一個例句） */
export function isModeAvailable(modeId: QuizModeId, item: VocabularyItem | GrammarItem): boolean {
  if (!getQuizMode(modeId).needsExamples) return true
  return 'examples' in item && Boolean(item.examples?.length)
}

/** 勾選的測驗方向中，適用於這個資料集分類、且這個項目能出題的那些 */
export function modesForItem(
  dataset: Dataset,
  item: VocabularyItem | GrammarItem,
  modeIds: readonly QuizModeId[],
): QuizModeId[] {
  return modeIds.filter(
    (id) => getQuizMode(id).category === dataset.category && isModeAvailable(id, item),
  )
}

export interface CardText {
  text: string
  lang: 'ja' | 'zh'
  /** 用【】標記的例句；有值時以高亮（或挖空）方式顯示，text 為去掉標記的純文字 */
  sentence?: string
  /** 把標記部分顯示成空格 */
  cloze?: boolean
}

export interface CardFace extends CardText {
  /** 主文字下方的補充，例如漢字＋讀音、完整例句 */
  sub?: CardText
  /** 再下方的說明，例如例句翻譯 */
  note?: CardText
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
  /** 答案是日文時，輸入作答可接受的寫法（漢字、讀音） */
  answers?: string[]
  /** 朗讀用的日文 */
  speech: string
  /** 正面就能朗讀（題目本身是日文）；否則要翻面後才能，以免洩漏答案 */
  speakOnFront: boolean
}

const SPEAK_ON_FRONT: readonly QuizModeId[] = [
  'vocab-kanji-to-zh',
  'vocab-kana-to-zh',
  'grammar-pattern-to-zh',
  'grammar-sentence-to-zh',
]

/** 單字念讀音（避免 TTS 讀錯漢字），文法念原形（去掉～），例句念整句 */
function speechFor(
  modeId: QuizModeId,
  item: VocabularyItem | GrammarItem,
  front: CardFace,
  back: CardFace,
): string {
  const sentence = front.sentence ?? back.sub?.sentence
  if (sentence) return stripMarkup(sentence)
  if (getQuizMode(modeId).category === 'vocabulary') {
    const v = item as VocabularyItem
    return v.hiragana?.trim() || v.japanese
  }
  return item.japanese.replace(/[～〜]/g, '')
}

const ja = (text: string): CardText => ({ text, lang: 'ja' })
const zh = (text: string): CardText => ({ text, lang: 'zh' })
const markedSentence = (sentence: string, cloze = false): CardText => ({
  text: cloze ? sentence.replace(/【[^【】]*】/g, '＿＿') : stripMarkup(sentence),
  lang: 'ja',
  sentence,
  cloze,
})

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
  random: RandomFn,
): Pick<StudyCard, 'front' | 'back' | 'answers'> {
  const explanation = item.full_explanation
  // 例句模式每次隨機挑一個例句
  const example = (): GrammarExample => pickRandom((item as GrammarItem).examples!, random)

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
        answers: reading ? [v.japanese, reading] : [v.japanese],
      }
    }
    case 'grammar-pattern-to-zh':
      return {
        front: ja(item.japanese),
        back: { ...zh(item.simple_chinese), sub: ja(item.japanese), explanation },
      }
    case 'grammar-sentence-to-zh': {
      const ex = example()
      return {
        front: markedSentence(ex.sentence),
        back: {
          ...zh(item.simple_chinese),
          sub: ja(item.japanese),
          note: ex.translation ? zh(ex.translation) : undefined,
          explanation,
        },
      }
    }
    case 'grammar-zh-to-pattern':
      return {
        front: zh(item.simple_chinese),
        back: { ...ja(item.japanese), explanation },
        answers: [item.japanese],
      }
    case 'grammar-cloze': {
      const ex = example()
      const blanks = parseMarkedSentence(ex.sentence)
        .filter((s) => s.marked)
        .map((s) => s.text)
      return {
        front: {
          ...markedSentence(ex.sentence, true),
          note: ex.translation ? zh(ex.translation) : undefined,
        },
        back: {
          ...ja(blanks.join('…')),
          sub: markedSentence(ex.sentence),
          note: zh(`${item.japanese}：${item.simple_chinese}`),
          explanation,
        },
        answers: [blanks.join('')],
      }
    }
  }
}

export function buildCard(
  dataset: Dataset,
  item: VocabularyItem | GrammarItem,
  modeId: QuizModeId,
  random: RandomFn = Math.random,
): StudyCard {
  const f = faces(modeId, item, random)
  return {
    key: `${dataset.id}:${item.id}:${modeId}`,
    datasetId: dataset.id,
    datasetName: dataset.name,
    itemId: item.id,
    modeId,
    ...f,
    speech: speechFor(modeId, item, f.front, f.back),
    speakOnFront: SPEAK_ON_FRONT.includes(modeId),
  }
}
