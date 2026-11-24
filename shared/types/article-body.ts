export type ArticleInline = { type: 'text'; text: string } | { type: 'link'; text: string; url: string }
export type ArticleBlock =
  | { type: 'paragraph'; parts: ArticleInline[] }
  | { type: 'heading'; level: 1 | 2 | 3; text: string; id: string }
  | { type: 'image'; alt: string; url: string }
  | { type: 'list'; ordered: boolean; items: ArticleInline[][] }
  | { type: 'code'; language: string; value: string }

function safeArticleUrl(value: string) {
  try {
    const url = new URL(value, 'https://navhub.invalid')
    if (url.username || url.password || !['http:', 'https:'].includes(url.protocol)) return undefined
    return value.startsWith('/') && !value.startsWith('//') ? value : url.href
  } catch { return undefined }
}

function headingId(value: string, used: Set<string>) {
  const base = value.toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 80) || 'section'
  let id = base
  let suffix = 2
  while (used.has(id)) id = `${base}-${suffix++}`
  used.add(id)
  return id
}

function inlineParts(value: string): ArticleInline[] {
  const parts: ArticleInline[] = []
  const pattern = /\[([^\]\r\n]{1,240})\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g
  let cursor = 0
  for (const match of value.matchAll(pattern)) {
    const url = safeArticleUrl(match[2]!)
    if (!url) continue
    const index = match.index!
    if (index > cursor) parts.push({ type: 'text', text: value.slice(cursor, index) })
    parts.push({ type: 'link', text: match[1]!, url })
    cursor = index + match[0].length
  }
  if (cursor < value.length) parts.push({ type: 'text', text: value.slice(cursor) })
  return parts
}

export function parseArticleBody(body: string): ArticleBlock[] {
  const lines = body.split('\n')
  const parts: ArticleBlock[] = []
  const headings = new Set<string>()
  let paragraph: string[] = []
  const flushParagraph = () => {
    const text = paragraph.join('\n')
    if (!text) { paragraph = []; return }
    const images = /!\[([^\]\r\n]{0,160})\]\((https?:\/\/[^\s)]+|\/api\/assets\/[0-9a-f-]{36})\)/g
    let cursor = 0
    for (const match of text.matchAll(images)) {
      const url = safeArticleUrl(match[2]!)
      if (!url) continue
      const index = match.index!
      if (index > cursor) parts.push({ type: 'paragraph', parts: inlineParts(text.slice(cursor, index)) })
      parts.push({ type: 'image', alt: match[1]!, url: match[2]! })
      cursor = index + match[0].length
    }
    if (cursor < text.length) parts.push({ type: 'paragraph', parts: inlineParts(text.slice(cursor)) })
    paragraph = []
  }

  const flushParagraphWithImages = (text: string) => {
    const images = /!\[([^\]\r\n]{0,160})\]\((https?:\/\/[^\s)]+|\/api\/assets\/[0-9a-f-]{36})\)/g
    let cursor = 0
    for (const match of text.matchAll(images)) {
      const url = safeArticleUrl(match[2]!)
      if (!url) continue
      const index = match.index!
      if (index > cursor) parts.push({ type: 'paragraph', parts: inlineParts(text.slice(cursor, index)) })
      parts.push({ type: 'image', alt: match[1]!, url: match[2]! })
      cursor = index + match[0].length
    }
    if (cursor < text.length) parts.push({ type: 'paragraph', parts: inlineParts(text.slice(cursor)) })
  }

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!
    const heading = /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(line)
    if (heading) {
      flushParagraph()
      const text = heading[2]!
      parts.push({ type: 'heading', level: heading[1]!.length as 1 | 2 | 3, text, id: headingId(text, headings) })
      continue
    }
    const fence = /^```([a-z0-9_+-]{0,24})\s*$/i.exec(line)
    if (fence) {
      flushParagraph()
      const code: string[] = []
      index++
      while (index < lines.length && !/^```\s*$/.test(lines[index]!)) code.push(lines[index++]!)
      parts.push({ type: 'code', language: fence[1]!.toLowerCase(), value: code.join('\n') })
      continue
    }
    const list = /^\s*((?:[-*+])|(?:\d+[.)]))\s+(.+)$/.exec(line)
    const imageOnly = /^\s*(!\[[^\]\r\n]{0,160}\]\((?:https?:\/\/[^\s)]+|\/api\/assets\/[0-9a-f-]{36})\))\s*$/.exec(line)
    if (imageOnly) {
      flushParagraph()
      flushParagraphWithImages(imageOnly[1]!)
      continue
    }
    if (list) {
      flushParagraph()
      const ordered = /^\d/.test(list[1]!)
      const items = [inlineParts(list[2]!)]
      while (index + 1 < lines.length) {
        const next = /^\s*((?:[-*+])|(?:\d+[.)]))\s+(.+)$/.exec(lines[index + 1]!)
        if (!next || /^\d/.test(next[1]!) !== ordered) break
        items.push(inlineParts(next[2]!))
        index++
      }
      parts.push({ type: 'list', ordered, items })
      continue
    }
    if (!line.trim()) flushParagraph()
    else paragraph.push(line)
  }
  flushParagraph()
  return parts
}

export function articleToc(parts: ArticleBlock[]) {
  return parts.filter((part): part is Extract<ArticleBlock, { type: 'heading' }> => part.type === 'heading' && part.level <= 2)
}
