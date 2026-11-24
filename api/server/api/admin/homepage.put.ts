import { homepageModulesSchema } from '#shared/schemas/homepage'
import { requireAdmin } from '../../utils/auth'
import { getHomepageRepository } from '../../utils/db'

export default defineEventHandler(async event => {
  const admin = await requireAdmin(event)
  const input = homepageModulesSchema.parse(await readBody(event))
  return { modules: await getHomepageRepository().replaceHomepageModules(input.modules, admin.admin_id) }
})
