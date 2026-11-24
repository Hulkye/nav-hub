import { z } from 'zod'
import { requireAdmin } from '../../../utils/auth'
import { getContentRepository } from '../../../utils/db'

const schema = z.object({ ids: z.array(z.string().uuid()).min(1).max(100), status: z.enum(['draft', 'published', 'offline']) }).strict()

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const input = schema.parse(await readBody(event))
  const updatedIds = await getContentRepository().bulkUpdateSites(input.ids, input.status, admin.admin_id)
  return { updated: updatedIds.length, ids: updatedIds }
})
