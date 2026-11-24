import { z } from 'zod'
import { requireAdmin } from '../../utils/auth'
import { getContentRepository } from '../../utils/db'

const querySchema = z.object({ failedOnly: z.enum(['true', 'false']).default('false'), includeIgnored: z.enum(['true', 'false']).default('false') }).strict()
export default defineEventHandler(async event => {
  await requireAdmin(event)
  const query = querySchema.parse(getQuery(event))
  const repository = getContentRepository()
  const [items, schedule] = await Promise.all([repository.listLinkHealthChecks({ failedOnly: query.failedOnly === 'true', includeIgnored: query.includeIgnored === 'true' }), repository.getLinkScheduleStatus()])
  return { items, schedule }
})
