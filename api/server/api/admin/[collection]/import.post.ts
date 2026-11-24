import { z } from 'zod'
import { adminContentSchemas } from '#shared/schemas/admin-content'
import { csvImportRows, validateImportRow, type ContentTransferCollection } from '../../../utils/content-transfer'
import { requireAdmin } from '../../../utils/auth'
import { getContentRepository } from '../../../utils/db'
import type { H3Event } from 'h3'

const schema = z.object({ collection: z.string().optional(), items: z.array(z.unknown()).min(1) }).strict()
const importTimeoutMs = 15 * 60 * 1000

async function readImportBody(event: H3Event) {
  const chunks: Buffer[] = []
  for await (const chunk of event.node.req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}
export default defineEventHandler(async event => {
  event.node.req.socket.setTimeout(importTimeoutMs)
  event.node.res.setTimeout(importTimeoutMs)
  const admin = await requireAdmin(event)
  const collection = (getRouterParam(event, 'collection') ?? getRequestURL(event).pathname.split('/')[3]) as ContentTransferCollection
  if (collection !== 'sites' && !Object.hasOwn(adminContentSchemas, collection)) throw createError({ statusCode: 404, message: '内容类型不存在' })
  const contentType = getHeader(event, 'content-type') ?? ''
  let body: unknown
  if (contentType.includes('text/csv')) {
    const raw = await readImportBody(event)
    if (!raw) throw createError({ statusCode: 400, message: '导入内容为空' })
    try { body = { items: csvImportRows(collection, raw) } } catch (error) { throw createError({ statusCode: 400, message: error instanceof Error ? error.message : 'CSV 格式无效' }) }
  } else {
    const raw = await readImportBody(event)
    if (!raw) throw createError({ statusCode: 400, message: '导入内容为空' })
    try { const json: unknown = JSON.parse(raw); body = Array.isArray(json) ? { items: json } : json } catch { throw createError({ statusCode: 400, message: 'JSON 格式无效', data: { code: 'INVALID_IMPORT' } }) }
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, message: '导入数据无效', data: { code: 'INVALID_IMPORT' } })
  if (parsed.data.collection && parsed.data.collection !== collection) throw createError({ statusCode: 400, message: '文件内容类型与当前列表不一致' })
  const valid: Array<{ rowNumber: number; data: Record<string, unknown> }> = []
  const rejected: Array<{ rowNumber: number; status: 'rejected'; errors: string[] }> = []
  parsed.data.items.forEach((item, index) => {
    const result = validateImportRow(collection, item)
    if (result.success) valid.push({ rowNumber: index + 1, data: result.data as Record<string, unknown> })
    else rejected.push({ rowNumber: index + 1, status: 'rejected', errors: result.errors })
  })
  const imported = await getContentRepository().importAdminContent(collection, valid, admin.admin_id, parsed.data.items.length, rejected.length, rejected)
  return { ...imported, rows: [...imported.rows, ...rejected].sort((a, b) => a.rowNumber - b.rowNumber) }
})
