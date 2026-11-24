import { relatedQuerySchema, relatedTargetSchema } from '../../../../../../../shared/schemas/discovery'
import { getDiscoveryRepository } from '../../../../../utils/db'

export default defineEventHandler(async (event) => {
  const target = relatedTargetSchema.safeParse({ type: getRouterParam(event, 'type'), id: getRouterParam(event, 'id') })
  const query = relatedQuerySchema.safeParse(getQuery(event))
  if (!target.success || !query.success) throw createError({ statusCode: 400, message: '推荐参数无效' })
  const results = await getDiscoveryRepository().related(target.data.type, target.data.id, query.data.limit)
  if (!results) throw createError({ statusCode: 404, message: '内容不存在', data: { code: 'CONTENT_NOT_FOUND' } })
  return { results }
})
