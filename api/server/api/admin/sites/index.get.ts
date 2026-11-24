import { getQuery } from 'h3'
import { z } from 'zod'
import { requireAdmin } from '../../../utils/auth'
import { getContentRepository } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const query = getQuery(event)
  try {
    const repository = getContentRepository()
    const [sites, quality] = await Promise.all([
      repository.listAdminSites({ page: query.page, pageSize: query.pageSize, status: query.status, q: query.q, categoryId: query.categoryId, qualityIssue: query.qualityIssue }),
      repository.getSiteQualitySummary()
    ])
    return { sites, quality }
  } catch (error) {
    if (error instanceof z.ZodError) throw createError({ statusCode: 400, message: '筛选或分页参数无效', data: { code: 'INVALID_QUERY' } })
    throw error
  }
})
