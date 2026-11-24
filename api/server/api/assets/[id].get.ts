import { contentIdSchema } from '#shared/schemas/admin-content'
import { getAssetRepository } from '../../utils/db'
import { getObjectStorage } from '../../utils/object-storage'

export default defineEventHandler(async event => {
  const id = contentIdSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 404, message: '图片不存在' })
  const asset = await getAssetRepository().get(id.data)
  if (!asset) throw createError({ statusCode: 404, message: '图片不存在' })
  let object
  try { object = await getObjectStorage().get(asset.object_key) } catch {
    console.error('[assets] Object read failed', { id: asset.id })
    throw createError({ statusCode: 502, message: '图片暂时无法读取' })
  }
  if (!object.Body) throw createError({ statusCode: 502, message: '图片存储响应为空' })
  setResponseHeaders(event, { 'Content-Type': asset.content_type, 'Content-Length': String(asset.byte_size), 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline', 'X-Robots-Tag': 'noindex' })
  return sendStream(event, object.Body.transformToWebStream())
})
