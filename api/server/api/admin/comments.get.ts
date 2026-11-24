import { getContentRepository } from '../../utils/db'
import { z } from 'zod'
import { requireAdmin } from '../../utils/auth'

const querySchema = z.object({ status: z.enum(['pending', 'approved', 'rejected', 'spam']).optional(), from: z.iso.date().optional(), to: z.iso.date().optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) }).strict().refine(query => !query.from || !query.to || query.from <= query.to, { message: '开始日期不能晚于结束日期' })
export default defineEventHandler(async event => {
  await requireAdmin(event)
  const query = querySchema.parse(getQuery(event))
  return { comments: await getContentRepository().listComments(query) }
})
