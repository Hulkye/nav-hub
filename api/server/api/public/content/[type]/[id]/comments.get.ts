import { getContentRepository } from '../../../../../utils/db'

export default defineEventHandler(async (event) => {
  const type = getRouterParam(event, 'type')!
  const id = getRouterParam(event, 'id')!
  if (!['site', 'resource', 'media', 'article'].includes(type)) throw createError({ statusCode: 400, message: '内容类型无效' })
  return { comments: await getContentRepository().listApprovedComments(type, id) }
})
