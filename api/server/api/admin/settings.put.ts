import { siteSettingsSchema } from '#shared/schemas/settings'
import { requireAdmin } from '../../utils/auth'
import { getHomepageRepository } from '../../utils/db'
import { handleImageReferenceError } from '../../utils/admin-content'

export default defineEventHandler(async event => {
  const admin = await requireAdmin(event)
  const input = siteSettingsSchema.parse(await readBody(event))
  return { settings: await handleImageReferenceError(() => getHomepageRepository().updateSiteSettings(input, admin.admin_id)) }
})
