import { getContentRepository } from '../../../utils/db'
import { requireAdmin } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const repository = getContentRepository()
  const id = getRouterParam(event, 'id')!
  const site = await repository.deleteSite(id)
  if (!site) throw createError({ statusCode: 404, message: '站点不存在', data: { code: 'SITE_NOT_FOUND' } })
  await repository.audit(admin.admin_id, 'delete', 'site', id)
  return { deleted: true }
})
