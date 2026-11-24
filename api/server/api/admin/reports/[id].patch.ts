import { z } from 'zod'
import { requireAdmin } from '../../../utils/auth'
import { getContentRepository } from '../../../utils/db'

const schema = z.object({ status: z.enum(['reviewed', 'dismissed']), note: z.string().trim().max(1000).nullable().default(null) }).strict()
export default defineEventHandler(async event => {
  const admin = await requireAdmin(event)
  const parsed = schema.safeParse(await readBody(event))
  const id = z.string().uuid().safeParse(getRouterParam(event, 'id'))
  if (!parsed.success || !id.success) throw createError({ statusCode: 400, message: '举报 ID、处理状态或备注无效' })
  const input = parsed.data
  const result = await getContentRepository().reviewReport(id.data, input.status, admin.admin_id, input.note)
  if (!result) throw createError({ statusCode: 409, message: '举报不存在或已处理' })
  return result
})
