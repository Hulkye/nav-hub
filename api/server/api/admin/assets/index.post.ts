import { randomUUID } from 'node:crypto'
import { requireAdmin } from '../../../utils/auth'
import { getAssetRepository } from '../../../utils/db'
import { getObjectStorage } from '../../../utils/object-storage'
import { ImageUploadError, MAX_UPLOAD_BYTES, normalizeImage } from '../../../utils/image-upload'
import { limitUploadBody } from '../../../utils/upload-body'

export default defineEventHandler(async event => {
  const admin = await requireAdmin(event)
  const storage = getObjectStorage()
  await limitUploadBody(event, MAX_UPLOAD_BYTES)
  const parts = await readMultipartFormData(event)
  if (!parts || parts.length !== 1 || parts[0]?.name !== 'file' || !parts[0].filename) throw createError({ statusCode: 400, message: '请上传一张图片，字段名为 file' })
  const file = parts[0]
  let image
  try { image = await normalizeImage(file.data, file.type ?? '') } catch (error) {
    if (error instanceof ImageUploadError) throw createError({ statusCode: 400, message: error.message })
    throw error
  }
  const id = randomUUID()
  const key = `images/${id}.webp`
  try { await storage.put(key, image.body) } catch {
    console.error('[assets] Object upload failed', { id })
    throw createError({ statusCode: 502, message: '图片存储写入失败，请稍后重试' })
  }
  let asset
  try {
    asset = await getAssetRepository().create({ id, object_key: key, filename: file.filename!.split(/[\\/]/).pop()!.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 160) || 'image', content_type: image.contentType, byte_size: image.body.length, width: image.width, height: image.height }, admin.admin_id)
  } catch (error) {
    try { await storage.remove(key) } catch { console.error('[assets] Orphan object cleanup failed', { id }) }
    throw error
  }
  const { object_key, ...publicAsset } = asset
  setResponseStatus(event, 201)
  return { ...publicAsset, url: `${new URL(useRuntimeConfig(event).public.siteUrl).origin}/api/assets/${id}` }
})
