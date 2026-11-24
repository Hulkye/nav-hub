import { requireAdmin } from '../../utils/auth'
import { getHomepageRepository } from '../../utils/db'

export default defineEventHandler(async event => {
  await requireAdmin(event)
  return { settings: await getHomepageRepository().getSiteSettings() }
})
