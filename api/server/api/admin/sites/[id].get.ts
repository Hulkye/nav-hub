import { requireAdmin } from '../../../utils/auth'
import { getContentRepository } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const site = await getContentRepository().getAdminSite(getRouterParam(event, 'id')!)
  if (!site) throw createError({ statusCode: 404, message: '网站不存在', data: { code: 'SITE_NOT_FOUND' } })
  return site
})
