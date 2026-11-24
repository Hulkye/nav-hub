import { z } from 'zod'
import { requireAdmin } from '../../utils/auth'
import { getContentRepository } from '../../utils/db'

const schema = z.object({ status: z.enum(['pending', 'reviewed', 'dismissed']).optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) }).strict()
export default defineEventHandler(async event => {
  await requireAdmin(event)
  const parsed = schema.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: '举报状态或分页参数无效' })
  return { reports: await getContentRepository().listReports(parsed.data) }
})
