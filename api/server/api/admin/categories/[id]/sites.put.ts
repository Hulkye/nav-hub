import { z } from 'zod'
import { requireAdmin } from '../../../../utils/auth'
import { getPublicDirectoryRepository } from '../../../../utils/db'

const inputSchema = z.object({
  items: z.array(z.object({ id: z.string().uuid(), pinned: z.boolean(), sortOrder: z.number().int().min(0).max(999999) }).strict()).max(2000)
}).strict().superRefine(({ items }, context) => {
  if (new Set(items.map(item => item.id)).size !== items.length) context.addIssue({ code: 'custom', path: ['items'], message: '网站不能重复' })
  if (new Set(items.map(item => item.sortOrder)).size !== items.length) context.addIssue({ code: 'custom', path: ['items'], message: '排序值不能重复' })
})

export default defineEventHandler(async event => {
  const admin = await requireAdmin(event)
  const parsed = inputSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: '分类网站排序数据无效', data: parsed.error.flatten() })
  try {
    const count = await getPublicDirectoryRepository().reorderCategorySites(getRouterParam(event, 'id')!, parsed.data.items, admin.admin_id)
    if (count === undefined) throw createError({ statusCode: 404, message: '分类不存在' })
    return { updated: count }
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_CATEGORY_SITE_ORDER') throw createError({ statusCode: 400, message: '排序列表必须完整包含该分类的全部已发布网站' })
    throw error
  }
})
