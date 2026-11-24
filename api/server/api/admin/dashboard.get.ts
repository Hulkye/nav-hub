import { requireAdmin } from '../../utils/auth'
import { getContentRepository } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event)
  const metrics = await getContentRepository().getDashboardMetrics()
  return { username: session.username, stage: 'content', ...metrics }
})
