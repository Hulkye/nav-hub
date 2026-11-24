import { z } from 'zod'

export const discoveryTypeSchema = z.enum(['site', 'resource', 'media', 'article', 'announcement'])
export const tagQuerySchema = z.object({
  type: z.enum(['all', ...discoveryTypeSchema.options]).default('all'),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20)
})
export const tagSlugSchema = z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
export const relatedQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(20).default(6) })
export const relatedTargetSchema = z.object({
  type: z.enum(['site', 'resource', 'media', 'article']),
  id: z.uuid()
})

export const detailTagsTargetSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('site'), id: tagSlugSchema }),
  z.object({ type: discoveryTypeSchema.exclude(['site']), id: z.uuid() })
])
