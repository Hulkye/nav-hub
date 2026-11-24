import { siteSchema } from '#shared/schemas/content'
import { requireAdmin } from '../../../utils/auth'
import { getContentRepository } from '../../../utils/db'
import { handleImageReferenceError } from '../../../utils/admin-content'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const input = siteSchema.parse(await readBody(event))
  const repository = getContentRepository()
  const id = getRouterParam(event, 'id')!
  const site = await handleImageReferenceError(() => repository.updateSite(id, input))
  if (!site) throw createError({ statusCode: 404, message: '站点不存在', data: { code: 'SITE_NOT_FOUND' } })
  await repository.audit(admin.admin_id, 'update', 'site', id)
  return site
})
