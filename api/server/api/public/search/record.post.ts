import { getSearchDiscoveryRepository } from '../../../utils/db'
import { searchRecordSchema } from '../../../../../shared/schemas/search'

export default defineEventHandler(async (event) => {
  const parsed = searchRecordSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: '搜索参数无效' })
  await getSearchDiscoveryRepository().record(parsed.data)
  setResponseStatus(event, 204)
  return null
})
