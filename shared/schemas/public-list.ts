import { z } from 'zod'

export const publicListSchema = z.object({
  q: z.string().trim().max(120).default(''),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  sort: z.enum(['latest', 'updated', 'title', 'popular']).default('latest'),
  subtype: z.enum(['all', 'software', 'website', 'document', 'other', 'book', 'movie', 'music']).default('all'),
  tag: z.union([z.literal(''), z.string().trim().max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)]).optional(),
  category: z.union([z.literal(''), z.string().trim().max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)]).optional()
})

export function parsePublicList(collection: 'sites' | 'resources' | 'media' | 'articles', raw: unknown) {
  const query = publicListSchema.parse(raw)
  const allowed = collection === 'resources' ? ['all', 'software', 'website', 'document', 'other']
    : collection === 'media' ? ['all', 'book', 'movie', 'music', 'other'] : ['all']
  if (!allowed.includes(query.subtype)) throw new Error('INVALID_CONTENT_SUBTYPE')
  return query
}

export interface PublicPage<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
