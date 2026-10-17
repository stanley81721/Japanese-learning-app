import MarkdownIt from 'markdown-it'

// html: false 會把原始 HTML 轉義，markdown-it 也會擋掉 javascript: 等危險連結，
// 所以輸出可以安全地用 v-html 顯示。
const md = new MarkdownIt({ html: false, linkify: true, breaks: true })

const defaultLinkOpen =
  md.renderer.rules.link_open ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  tokens[idx]!.attrSet('target', '_blank')
  tokens[idx]!.attrSet('rel', 'noopener noreferrer')
  return defaultLinkOpen(tokens, idx, options, env, self)
}

export function renderMarkdown(source: string): string {
  return md.render(source)
}
