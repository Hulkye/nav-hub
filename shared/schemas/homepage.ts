import { z } from 'zod'
import { httpUrlSchema } from './content'

const bannerUrlSchema = z.union([z.literal(''), httpUrlSchema, z.string().trim().max(2048).regex(/^\/(?!\/)/).refine(value => !/[\\\s\u0000-\u001f]/.test(value))])

export const homepageModuleTypeSchema = z.enum(['featured', 'latest', 'updated', 'popular', 'popular_categories', 'category', 'announcement', 'banner'])
export const homepageContentTypeSchema = z.enum(['site', 'resource', 'media', 'article', 'announcement'])
export const homepageBackgroundSchema = z.enum(['default', 'surface', 'accent'])
export const homepageDensitySchema = z.enum(['compact', 'comfortable', 'relaxed'])
export const homepageModuleSchema = z
  .object({
    id: z.string().uuid().optional(),
    moduleType: homepageModuleTypeSchema,
    placement: z.string().min(1).max(40).default('top'),
    contentType: homepageContentTypeSchema.default('site'),
    title: z.string().trim().max(160).default(''),
    enabled: z.boolean().default(true),
    sortOrder: z.number().int().min(0).max(9999),
    itemLimit: z.number().int().min(1).max(48).default(12),
    categoryId: z.string().uuid().nullable().default(null),
    contentIds: z.array(z.string().uuid()).max(100).default([]),
    bannerText: z.string().trim().max(500).default(''),
    bannerUrl: bannerUrlSchema.default(''),
    background: homepageBackgroundSchema.default('default'),
    density: homepageDensitySchema.default('comfortable')
  })
  .strict()
  .superRefine((value, context) => {
    if (value.placement !== 'top' && !z.string().uuid().safeParse(value.placement).success)
      context.addIssue({ code: 'custom', path: ['placement'], message: '插入位置必须是有效分类或首页顶部' })
    if (value.moduleType === 'category' && !value.categoryId)
      context.addIssue({ code: 'custom', path: ['categoryId'], message: '分类模块必须选择分类' })
    if (value.moduleType !== 'category' && value.categoryId)
      context.addIssue({ code: 'custom', path: ['categoryId'], message: '只有分类模块可以关联分类' })
    if (value.moduleType !== 'featured' && value.contentIds.length)
      context.addIssue({ code: 'custom', path: ['contentIds'], message: '只有精选模块可以关联内容' })
    if (value.moduleType === 'category' && value.contentType !== 'site')
      context.addIssue({ code: 'custom', path: ['contentType'], message: '分类模块仅支持网站' })
    if (value.moduleType === 'popular_categories' && value.contentType !== 'site')
      context.addIssue({ code: 'custom', path: ['contentType'], message: '热门分类仅支持网站' })
    if (new Set(value.contentIds).size !== value.contentIds.length)
      context.addIssue({ code: 'custom', path: ['contentIds'], message: '精选内容不能重复' })
  })

export const homepageModulesSchema = z
  .object({ modules: z.array(homepageModuleSchema).max(20) })
  .strict()
  .superRefine((value, context) => {
    const orders = new Set<number>()
    value.modules.forEach((module, index) => {
      if (orders.has(module.sortOrder))
        context.addIssue({ code: 'custom', path: ['modules', index, 'sortOrder'], message: '排序值不能重复' })
      orders.add(module.sortOrder)
    })
  })

export type HomepageModuleInput = z.infer<typeof homepageModuleSchema>
