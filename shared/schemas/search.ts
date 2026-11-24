import { z } from 'zod'

export const publicSearchSchema = z.object({
  q: z.string().trim().max(120).default(''),
  type: z.enum(['all', 'site', 'resource', 'media', 'article', 'announcement']).default('all'),
  tag: z.string().trim().max(120).default(''),
  category: z.string().trim().max(120).default(''),
  sort: z.enum(['relevance', 'popular', 'latest']).default('relevance'),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20)
})
export type PublicSearchOptions = z.infer<typeof publicSearchSchema>

export const searchDiscoverySchema = publicSearchSchema.pick({ q: true, type: true, tag: true, category: true, sort: true })
export const searchRecordSchema = z.object({ q: z.string().trim().min(2).max(120), type: publicSearchSchema.shape.type.default('all'), resultCount: z.number().int().min(0).max(10000) }).strict()
export const searchClickSchema = z.object({ q: z.string().trim().min(2).max(120), type: publicSearchSchema.shape.type.default('all'), contentType: z.enum(['site', 'resource', 'media', 'article', 'announcement']).optional() }).strict()
export type SearchResultType = Exclude<PublicSearchOptions['type'], 'all'>
export interface SearchDiscoveryItem { id: string; title: string; slug: string; description: string; type: SearchResultType; icon_url?: string | null; target_url?: string | null }
export interface SearchDiscovery {
  popular: string[]
  suggestions: string[]
  results: SearchDiscoveryItem[]
  recommendations: SearchDiscoveryItem[]
  categories: Array<{ id: string; name: string; slug: string; count: number }>
  tags: Array<{ name: string; slug: string; count: number }>
}
