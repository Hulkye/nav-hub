import { z } from 'zod'
import { isTaxonomyIcon } from '../utils/taxonomy-icons'

export const httpUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .regex(/^\S+$/, 'URL 不得包含空白字符')
  .url()
  .refine(value => {
    try {
      const url = new URL(value)
      return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !/\s/.test(value)
    } catch {
      return false
    }
  }, '仅支持不含凭据的 HTTP(S) 地址')

const slug = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug 格式无效')

const taxonomyIcon = z.string().max(80).refine(isTaxonomyIcon, '请选择有效的 IconPark 图标').nullable().optional()

export const categorySchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    slug,
    description: z.string().trim().max(500).default(''),
    parentId: z.string().uuid().nullable().default(null),
    iconName: taxonomyIcon,
    sortOrder: z.number().int().min(0).max(999999).default(0)
  })
  .strict()

export const tagSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    slug,
    description: z.string().trim().max(500).default(''),
    iconName: taxonomyIcon,
    sortOrder: z.number().int().min(0).max(999999).default(0)
  })
  .strict()

export const siteSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    slug,
    description: z.string().trim().max(2000).default(''),
    body: z.string().trim().max(50000).default(''),
    targetUrl: httpUrlSchema,
    backupUrl: httpUrlSchema.nullable().default(null),
    previewUrl: httpUrlSchema.nullable().default(null),
    iconUrl: httpUrlSchema.nullable().default(null),
    status: z.enum(['draft', 'published', 'offline']).default('draft'),
    sortOrder: z.number().int().min(0).max(999999).default(0),
    categoryIds: z.array(z.string().uuid()).max(20).default([]),
    tagIds: z.array(z.string().uuid()).max(50).default([])
  })
  .strict()

export const contentTypeSchema = z.enum(['site', 'resource', 'media', 'article'])
const submissionBase = {
  title: z.string().trim().min(1).max(160),
  slug: slug.optional(),
  description: z.string().trim().max(2000).default('')
}
const submitter = {
  submitterName: z.string().trim().max(80).optional(),
  contactEmail: z.string().trim().email().max(254).optional().or(z.literal(''))
}
export const submissionSchema = z.discriminatedUnion('contentType', [
  z
    .object({
      contentType: z.literal('site'),
      payload: z.object({ ...submissionBase, targetUrl: httpUrlSchema, iconUrl: httpUrlSchema.nullable().optional() }).strict(),
      ...submitter
    })
    .strict(),
  z
    .object({
      contentType: z.literal('resource'),
      payload: z
        .object({
          ...submissionBase,
          resourceType: z.enum(['software', 'website', 'document', 'other']).default('software'),
          targetUrl: httpUrlSchema,
          coverUrl: httpUrlSchema.nullable().optional()
        })
        .strict(),
      ...submitter
    })
    .strict(),
  z
    .object({
      contentType: z.literal('media'),
      payload: z
        .object({
          ...submissionBase,
          mediaType: z.enum(['book', 'movie', 'music', 'other']).default('book'),
          coverUrl: httpUrlSchema.nullable().optional(),
          rating: z.number().min(0).max(10).optional()
        })
        .strict(),
      ...submitter
    })
    .strict(),
  z
    .object({
      contentType: z.literal('article'),
      payload: z
        .object({
          title: submissionBase.title,
          slug: slug.optional(),
          summary: z.string().trim().max(2000).default(''),
          body: z.string().trim().min(1).max(50000),
          coverUrl: httpUrlSchema.nullable().optional()
        })
        .strict(),
      ...submitter
    })
    .strict()
])

export const commentSchema = z
  .object({
    contentType: contentTypeSchema,
    contentId: z.string().uuid(),
    displayName: z.string().trim().min(1).max(80),
    email: z.string().trim().email().max(254).optional().or(z.literal('')),
    body: z.string().trim().min(3).max(2000)
  })
  .strict()

export const reportSchema = z
  .object({
    contentType: z.enum(['site', 'resource', 'media', 'article']),
    contentId: z.string().uuid(),
    reason: z.enum(['broken_link', 'wrong_content', 'spam', 'copyright', 'other']),
    details: z.string().trim().max(2000).default(''),
    reporterName: z.string().trim().max(80).optional().or(z.literal('')),
    contactEmail: z.string().trim().email().max(254).optional().or(z.literal(''))
  })
  .strict()

export type SubmissionInput = z.infer<typeof submissionSchema>
export type CommentInput = z.infer<typeof commentSchema>
export type ReportInput = z.infer<typeof reportSchema>
