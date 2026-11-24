import { tagQuerySchema, tagSlugSchema } from '../../../../../shared/schemas/discovery'
import { getDiscoveryRepository } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const slug = tagSlugSchema.safeParse(getRouterParam(event, 'slug'))
  const query = tagQuerySchema.safeParse(getQuery(event))
  if (!slug.success || !query.success) throw createError({ statusCode: 400, message: '标签参数无效' })
  const result = await getDiscoveryRepository().getTag(slug.data, query.data)
  if (!result) throw createError({ statusCode: 404, message: '标签不存在', data: { code: 'TAG_NOT_FOUND' } })
  return result
})
