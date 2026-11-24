import { detailTagsTargetSchema } from '../../../../../../../shared/schemas/discovery'
import { getDiscoveryRepository } from '../../../../../utils/db'

export default defineEventHandler(async (event) => {
  const target = detailTagsTargetSchema.safeParse({ type: getRouterParam(event, 'type'), id: getRouterParam(event, 'id') })
  if (!target.success) throw createError({ statusCode: 400, message: '标签参数无效' })
  const tags = await getDiscoveryRepository().detailTags(target.data.type, target.data.id)
  if (!tags) throw createError({ statusCode: 404, message: '内容不存在' })
  return { tags }
})
