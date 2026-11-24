import { z } from 'zod'
import { requireAdmin } from '../../../utils/auth'
import { csvExport, importTemplate } from '../../../utils/content-transfer'

export default defineEventHandler(async event => {
  await requireAdmin(event)
  const collection = z.enum(['sites', 'resources', 'media', 'articles', 'announcements']).safeParse(getRouterParam(event, 'collection') ?? getRequestURL(event).pathname.split('/')[3])
  const format = z.enum(['json', 'csv']).default('json').safeParse(getQuery(event).format)
  if (!collection.success) throw createError({ statusCode: 404, message: '内容类型不存在' })
  if (!format.success) throw createError({ statusCode: 400, message: '模板格式无效' })
  const sample = importTemplate(collection.data)
  if (format.data === 'json') return { collection: collection.data, items: [sample] }
  const snakeCase = Object.fromEntries(Object.entries(sample).map(([key, value]) => [key.replace(/[A-Z]/g, char => `_${char.toLowerCase()}`), value]))
  setResponseHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  return csvExport(collection.data, [snakeCase])
})
