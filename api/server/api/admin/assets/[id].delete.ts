import { contentIdSchema } from '#shared/schemas/admin-content'
import { requireAdmin } from '../../../utils/auth'
import { getAssetRepository } from '../../../utils/db'
import { getObjectStorage } from '../../../utils/object-storage'

export default defineEventHandler(async event => {
  const admin = await requireAdmin(event)
  const parsed = contentIdSchema.safeParse(getRouterParam(event, 'id'))
  if (!parsed.success) throw createError({ statusCode: 400, message: '图片 ID 无效' })
  const repository = getAssetRepository()
  const storage = getObjectStorage()
  const result = await repository.remove(parsed.data, admin.admin_id, async key => {
    try { await storage.remove(key) } catch {
      console.error('[assets] Object delete failed', { id: parsed.data })
      throw createError({ statusCode: 502, message: '对象存储删除失败，图片记录已保留，请稍后重试' })
    }
  })
  if (!result) throw createError({ statusCode: 404, message: '图片不存在' })
  if (!result.deleted) throw createError({ statusCode: 409, message: '图片仍被内容引用，解除引用后才能删除', data: { code: 'ASSET_IN_USE', references: result.references } })
  return { deleted: true }
})
