import { requireAdmin } from '../../../utils/auth'
import { getContentRepository } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const id = getRouterParam(event, 'id')!
  const repository = getContentRepository()
  const category = await repository.deleteCategory(id)
  if (!category) throw createError({ statusCode: 404, message: '分类不存在', data: { code: 'CATEGORY_NOT_FOUND' } })
  await repository.audit(admin.admin_id, 'delete', 'category', id)
  return { deleted: true }
})
