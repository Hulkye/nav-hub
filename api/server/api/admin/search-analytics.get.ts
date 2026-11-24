import { requireAdmin } from '../../utils/auth'
import { getContentRepository } from '../../utils/db'

export default defineEventHandler(async event => {
  await requireAdmin(event)
  return getContentRepository().getSearchAnalytics()
})
