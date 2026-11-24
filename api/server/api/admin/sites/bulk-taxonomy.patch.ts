import { z } from 'zod'
import { requireAdmin } from '../../../utils/auth'
import { getContentRepository } from '../../../utils/db'

const schema = z.object({ ids: z.array(z.string().uuid()).min(1).max(100), categoryIds: z.array(z.string().uuid()).max(20), tagIds: z.array(z.string().uuid()).max(50) }).strict()
export default defineEventHandler(async event => {
  const admin = await requireAdmin(event)
  const input = schema.parse(await readBody(event))
  try {
    const ids = await getContentRepository().bulkUpdateSiteTaxonomy(input.ids, input.categoryIds, input.tagIds, admin.admin_id)
    return { updated: ids.length, ids }
  } catch (error) {
    if (error instanceof Error && error.message === 'SITES_NOT_FOUND') throw createError({ statusCode: 404, message: '部分网站不存在，请刷新列表后重试' })
    throw error
  }
})
