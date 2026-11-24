import { siteSchema } from '#shared/schemas/content'
import { requireAdmin } from '../../../utils/auth'
import { getContentRepository } from '../../../utils/db'
import { handleImageReferenceError } from '../../../utils/admin-content'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const input = siteSchema.parse(await readBody(event))
  const repository = getContentRepository()
  const site = await handleImageReferenceError(() => repository.createSite(input))
  await repository.audit(admin.admin_id, 'create', 'site', String(site?.id))
  return site
})
