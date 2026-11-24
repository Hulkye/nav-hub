import { z } from 'zod'
import { adminContentSchemas } from '#shared/schemas/admin-content'
import { csvExport, whitelistExport, type ContentTransferCollection } from '../../../utils/content-transfer'
import { requireAdmin } from '../../../utils/auth'
import { getContentRepository } from '../../../utils/db'

const formatSchema = z.enum(['json', 'csv']).default('json')
const siteFiltersSchema = z.object({ q: z.string().trim().max(120).default(''), status: z.enum(['draft', 'published', 'offline']).optional(), categoryId: z.string().uuid().optional(), qualityIssue: z.enum(['missing_description', 'missing_category', 'broken_url', 'duplicate_site']).optional() }).strict()
export default defineEventHandler(async event => {
  const admin = await requireAdmin(event)
  const collection = (getRouterParam(event, 'collection') ?? getRequestURL(event).pathname.split('/')[3]) as ContentTransferCollection
  if (collection !== 'sites' && !Object.hasOwn(adminContentSchemas, collection)) throw createError({ statusCode: 404, message: '内容类型不存在' })
  const parsed = formatSchema.safeParse(getQuery(event).format)
  if (!parsed.success) throw createError({ statusCode: 400, message: '导出格式仅支持 JSON 或 CSV' })
  const format = parsed.data
  const repository = getContentRepository()
  let rows
  let filters
  if (collection === 'sites') filters = siteFiltersSchema.parse(getQuery(event))
  try { rows = await repository.exportAdminContent(collection, filters) } catch (error) {
    if (error instanceof Error && error.message === 'EXPORT_LIMIT_EXCEEDED') throw createError({ statusCode: 400, message: '导出最多支持 1000 条，请使用数据库备份处理更大数据量' })
    throw error
  }
  await repository.audit(admin.admin_id, 'export', collection)
  if (format === 'csv') {
    setResponseHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
    setResponseHeader(event, 'Content-Disposition', `attachment; filename="${collection}.csv"`)
    return csvExport(collection, rows)
  }
  return { collection, items: whitelistExport(collection, rows) }
})
