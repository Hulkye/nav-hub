import { getSearchDiscoveryRepository } from '../../utils/db'
import { publicSearchSchema } from '../../../../shared/schemas/search'

export default defineEventHandler(async (event) => {
  const parsed = publicSearchSchema.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: '搜索参数无效', data: parsed.error.flatten() })
  return getSearchDiscoveryRepository().search(parsed.data)
})
