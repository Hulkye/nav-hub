import type { ArticleNavigation, DiscoveryItem } from './discovery'

export type PublicCollection = 'resources' | 'media' | 'articles' | 'announcements'

export interface PublicContent {
  id: string
  title: string
  slug?: string
  description?: string
  summary?: string
  body?: string
  cover_url?: string | null
  target_url?: string | null
  resource_type?: string
  media_type?: string
  rating?: string | number | null
  platforms?: string[]
  version?: string
  screenshots?: string[]
  download_sources?: Array<{ label: string; url: string; extractionCode?: string }>
  version_history?: Array<{ version: string; releasedAt?: string | null; notes?: string }>
  author?: string
  director?: string
  publisher?: string
  release_date?: string | null
  channels?: Array<{ kind: string; label: string; url: string }>
  published_at?: string | null
  category_ids?: string[]
  created_at?: string
  recommendations?: DiscoveryItem[]
  navigation?: ArticleNavigation
}

export const publicContentLabels: Record<PublicCollection, string> = {
  resources: '资源',
  media: '书影音',
  articles: '文章',
  announcements: '公告'
}

export function publicContentHref(collection: PublicCollection, item: PublicContent) {
  return `/${collection}/${encodeURIComponent(item.slug ?? item.id)}`
}

export function safeExternalUrl(value?: string | null) {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined
  } catch {
    return undefined
  }
}
