import { z } from 'zod'
import { requireAdmin } from '../../utils/auth'
import { getContentRepository } from '../../utils/db'

const querySchema = z.object({ days: z.coerce.number().int().min(1).max(90).default(7) })
export default defineEventHandler(async event => {
  await requireAdmin(event)
  const { days } = querySchema.parse(getQuery(event))
  const end = new Date()
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
  return { days, start: start.toISOString(), end: end.toISOString(), ...(await getContentRepository().getEventStats(start, end)) }
})
