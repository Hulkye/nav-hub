import { z } from 'zod'
import { httpUrlSchema } from '../schemas/content'

const itemSchema = z.object({
  slug: z.string().max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1).max(160),
  url: httpUrlSchema,
  visitedAt: z.string().datetime().optional()
}).strict()
export type LocalNavigationItem = z.infer<typeof itemSchema>
export const navigationLimits = { favorites: 50, recent: 20 } as const
export const navigationKeys = { favorites: 'navhub:favorites', recent: 'navhub:recent' } as const
export type NavigationKind = keyof typeof navigationLimits

export function parseNavigation(raw: string | null, kind: NavigationKind): LocalNavigationItem[] {
  if (raw === null) return []
  if (raw.length > 262144) throw new Error('本地导航数据过大，请清空后重试')
  const entries: unknown = JSON.parse(raw)
  if (!Array.isArray(entries)) throw new Error('本地导航数据格式错误，请清空后重试')
  const parsed = entries.map(entry => itemSchema.parse(entry))
  return parsed.filter((item, index) => parsed.findIndex(other => other.slug === item.slug) === index).slice(0, navigationLimits[kind])
}

export function prependNavigation(items: LocalNavigationItem[], item: LocalNavigationItem, kind: NavigationKind) {
  const valid = itemSchema.parse(item)
  return [valid, ...items.filter(other => other.slug !== valid.slug)].slice(0, navigationLimits[kind])
}
