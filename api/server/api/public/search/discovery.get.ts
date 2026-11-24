import { getSearchDiscoveryRepository } from '../../../utils/db'
import { searchDiscoverySchema } from '../../../../../shared/schemas/search'

export default defineEventHandler(async (event) => {
  const parsed = searchDiscoverySchema.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: '搜索参数无效' })
  return getSearchDiscoveryRepository().discover(parsed.data)
})
