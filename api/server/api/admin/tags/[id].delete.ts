import { requireAdmin } from '../../../utils/auth'
import { getContentRepository } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const id = getRouterParam(event, 'id')!
  const repository = getContentRepository()
  const tag = await repository.deleteTag(id)
  if (!tag) throw createError({ statusCode: 404, message: '标签不存在', data: { code: 'TAG_NOT_FOUND' } })
  await repository.audit(admin.admin_id, 'delete', 'tag', id)
  return { deleted: true }
})
