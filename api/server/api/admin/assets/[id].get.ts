import { contentIdSchema } from '#shared/schemas/admin-content'
import { requireAdmin } from '../../../utils/auth'
import { getAssetRepository } from '../../../utils/db'

export default defineEventHandler(async event => {
  await requireAdmin(event)
  const parsed = contentIdSchema.safeParse(getRouterParam(event, 'id'))
  if (!parsed.success) throw createError({ statusCode: 400, message: '图片 ID 无效' })
  const asset = await getAssetRepository().get(parsed.data)
  if (!asset) throw createError({ statusCode: 404, message: '图片不存在' })
  const { object_key, ...metadata } = asset
  return { ...metadata, references: await getAssetRepository().references(parsed.data), url: `${new URL(useRuntimeConfig(event).public.siteUrl).origin}/api/assets/${asset.id}` }
})
