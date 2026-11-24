import { getSearchDiscoveryRepository } from '../../../utils/db'
import { searchClickSchema } from '../../../../../shared/schemas/search'

export default defineEventHandler(async event => {
  const parsed = searchClickSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: '搜索参数无效' })
  await getSearchDiscoveryRepository().recordClick(parsed.data)
  setResponseStatus(event, 204)
  return null
})
