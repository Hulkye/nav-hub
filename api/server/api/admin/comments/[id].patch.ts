import { z } from 'zod'
import { requireAdmin } from '../../../utils/auth'
import { getContentRepository } from '../../../utils/db'

const schema = z.object({ status: z.enum(['approved', 'rejected', 'spam']), note: z.string().trim().max(1000).nullable().default(null) }).strict()
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const input = schema.parse(await readBody(event))
  const result = await getContentRepository().reviewComment(getRouterParam(event, 'id')!, input.status, admin.admin_id, input.note)
  if (!result) throw createError({ statusCode: 409, message: '评论不存在或已审核', data: { code: 'COMMENT_ALREADY_REVIEWED' } })
  return result
})
