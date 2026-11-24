import { z } from 'zod'
import { httpUrlSchema } from './content'

const base = {
  title: z.string().trim().min(1).max(160),
  status: z.enum(['draft', 'published', 'offline']).default('draft'),
  tagIds: z.array(z.string().uuid()).max(50).default([]),
  categoryIds: z.array(z.string().uuid()).max(20).default([])
}
const slug = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug 格式无效')
const coverUrl = httpUrlSchema.nullable().default(null)
const description = z.string().trim().max(2000).default('')
const shortText = z.string().trim().max(160).default('')
export const downloadSourceSchema = z.object({
  label: z.string().trim().min(1).max(80),
  url: httpUrlSchema,
  extractionCode: z.string().trim().max(80).default('')
}).strict()
export const resourceEnrichment = {
  platforms: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  version: z.string().trim().max(80).default(''),
  screenshots: z.array(httpUrlSchema).max(12).default([]),
  downloadSources: z.array(downloadSourceSchema).max(12).default([]),
  versionHistory: z.array(z.object({ version: z.string().trim().min(1).max(80), releasedAt: z.iso.date().nullable().default(null), notes: z.string().trim().max(2000).default('') }).strict()).max(30).default([])
}
export const mediaChannelSchema = z.object({
  kind: z.enum(['read', 'watch', 'listen', 'official']),
  label: z.string().trim().min(1).max(80),
  url: httpUrlSchema
}).strict()
export const mediaEnrichment = {
  author: shortText,
  director: shortText,
  publisher: shortText,
  releaseDate: z.iso.date().nullable().default(null),
  channels: z.array(mediaChannelSchema).max(12).default([])
}
export const resourceSchema = z
  .object({
    ...base,
    slug,
    description,
    coverUrl,
    ...resourceEnrichment,
    resourceType: z.enum(['software', 'website', 'document', 'other']).default('software'),
    targetUrl: httpUrlSchema
  })
  .strict()
export const mediaSchema = z
  .object({
    ...base,
    slug,
    description,
    coverUrl,
    ...mediaEnrichment,
    mediaType: z.enum(['book', 'movie', 'music', 'other']).default('book'),
    rating: z.number().min(0).max(10).multipleOf(0.1).nullable().default(null)
  })
  .strict()
  .superRefine((input, ctx) => {
    const allowed = input.mediaType === 'book' ? ['read', 'official'] : input.mediaType === 'movie' ? ['watch', 'official'] : input.mediaType === 'music' ? ['listen', 'official'] : ['read', 'watch', 'listen', 'official']
    input.channels.forEach((channel, index) => {
      if (!allowed.includes(channel.kind)) ctx.addIssue({ code: 'custom', path: ['channels', index, 'kind'], message: '渠道类型必须与媒体类型一致' })
    })
  })
export const articleSchema = z.object({ ...base, slug, summary: description, body: z.string().trim().min(1).max(50000), coverUrl }).strict()
export const announcementSchema = z
  .object({
    ...base,
    body: z.string().trim().min(1).max(50000),
    targetUrl: httpUrlSchema.nullable().default(null),
    startsAt: z.iso.datetime({ offset: true }).nullable().default(null),
    endsAt: z.iso.datetime({ offset: true }).nullable().default(null)
  })
  .strict()
  .refine(input => !input.startsAt || !input.endsAt || Date.parse(input.endsAt) > Date.parse(input.startsAt), {
    message: '结束时间必须晚于开始时间',
    path: ['endsAt']
  })
export const adminContentSchemas = {
  resources: resourceSchema,
  media: mediaSchema,
  articles: articleSchema,
  announcements: announcementSchema
}
export type AdminContentCollection = keyof typeof adminContentSchemas
export const contentIdSchema = z.string().uuid()
