export interface SentenceSegment {
  text: string
  /** 是否為【】標記的文法部分 */
  marked: boolean
}

/** 把「若い【うちに】勉強する」拆成一般文字與標記文字的片段 */
export function parseMarkedSentence(sentence: string): SentenceSegment[] {
  const segments: SentenceSegment[] = []
  const pattern = /【([^【】]*)】/g
  let last = 0
  for (const match of sentence.matchAll(pattern)) {
    if (match.index > last) segments.push({ text: sentence.slice(last, match.index), marked: false })
    segments.push({ text: match[1]!, marked: true })
    last = match.index + match[0].length
  }
  if (last < sentence.length) segments.push({ text: sentence.slice(last), marked: false })
  return segments
}

/** 去掉【】標記，例如給 TTS 朗讀用 */
export function stripMarkup(sentence: string): string {
  return sentence.replace(/[【】]/g, '')
}
