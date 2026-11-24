import { requireAdmin } from '../../../utils/auth'
import { getContentRepository } from '../../../utils/db'
import { contentIdSchema } from '#shared/schemas/admin-content'

export default defineEventHandler(async event => {
  await requireAdmin(event)
  const id = contentIdSchema.parse(getRouterParam(event, 'id'))
  const repository = getContentRepository()
  const comment = await repository.getComment(id)
  if (!comment) throw createError({ statusCode: 404, message: '评论不存在' })
  return { ...comment, history: await repository.getModerationHistory('comment', id) }
})
