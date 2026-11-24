import type { z } from 'zod'
import type { discoveryTypeSchema } from '../schemas/discovery'

export type DiscoveryType = z.infer<typeof discoveryTypeSchema>
export interface DiscoveryItem {
  id: string
  type: DiscoveryType
  title: string
  slug: string
  summary: string
  published_at: string | null
  shared_tags?: number
}
export interface PublicTag {
  id: string
  name: string
  slug: string
  description: string
  count: number
}
export type DetailTag = Pick<PublicTag, 'id' | 'name' | 'slug'>
export interface ArticleLink { id: string; title: string; slug: string }
export interface ArticleNavigation {
  previous: ArticleLink | null
  next: ArticleLink | null
}
export interface TagContentPage {
  tag: PublicTag
  results: DiscoveryItem[]
  total: number
  page: number
  pageSize: number
}
export const discoveryLabels: Record<DiscoveryType, string> = { site: '网站', resource: '资源', media: '书影音', article: '文章', announcement: '公告' }
export function discoveryHref(item: DiscoveryItem) {
  const collection = { site: 'sites', resource: 'resources', media: 'media', article: 'articles', announcement: 'announcements' }[item.type]
  return `/${collection}/${encodeURIComponent(item.type === 'announcement' ? item.id : item.slug)}`
}
