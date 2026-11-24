import { requireAdmin } from '../../../utils/auth'
import { getContentRepository } from '../../../utils/db'
import { contentIdSchema } from '#shared/schemas/admin-content'

export default defineEventHandler(async event => {
  await requireAdmin(event)
  const id = contentIdSchema.parse(getRouterParam(event, 'id'))
  const repository = getContentRepository()
  const submission = await repository.getSubmission(id)
  if (!submission) throw createError({ statusCode: 404, message: '投稿不存在' })
  return { ...submission, history: await repository.getModerationHistory('submission', id) }
})
