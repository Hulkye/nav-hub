import { requireAdmin } from '../../utils/auth'
import { getHomepageRepository } from '../../utils/db'

export default defineEventHandler(async event => {
  await requireAdmin(event)
  return { modules: await getHomepageRepository().listHomepageModules(true) }
})
