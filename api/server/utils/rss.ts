export interface RssItem {
  content_type: 'site' | 'resource' | 'media' | 'article'
  slug: string
  title: string
  summary: string
  published_at: Date | string | null
}

function xml(value: string) {
  return value.replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!)
}

export function renderRss(siteUrl: string, items: RssItem[]) {
  const base = new URL(siteUrl)
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw new Error('INVALID_SITE_URL')
  const origin = base.origin
  const paths = { site: 'sites', resource: 'resources', media: 'media', article: 'articles' }
  const entries = items.map(item => {
    const url = `${origin}/${paths[item.content_type]}/${encodeURIComponent(item.slug)}`
    const date = item.published_at ? new Date(item.published_at) : null
    if (date && Number.isNaN(date.getTime())) throw new Error('INVALID_PUBLICATION_DATE')
    return `<item><title>${xml(item.title)}</title><link>${xml(url)}</link><guid isPermaLink="true">${xml(url)}</guid><description>${xml(item.summary)}</description><category>${item.content_type}</category>${date ? `<pubDate>${date.toUTCString()}</pubDate>` : ''}</item>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>NavHub</title><link>${xml(origin)}/</link><description>NavHub 最新网站、资源、媒体和文章</description><language>zh-CN</language><atom:link href="${xml(origin)}/rss.xml" rel="self" type="application/rss+xml"/>${entries}</channel></rss>`
}
