import { z } from 'zod'
import { requireAdmin } from '../../../utils/auth'
import { getAssetRepository } from '../../../utils/db'

export default defineEventHandler(async event => {
  await requireAdmin(event)
  const page = z.coerce.number().int().min(1).max(100000).safeParse(getQuery(event).page ?? 1)
  if (!page.success) throw createError({ statusCode: 400, message: '分页参数无效' })
  const query = getQuery(event)
  const search = z.string().trim().max(120).safeParse(query.q ?? '')
  if (!search.success) throw createError({ statusCode: 400, message: '搜索词不得超过 120 个字符' })
  const result = await getAssetRepository().list(page.data, search.data)
  const origin = new URL(useRuntimeConfig(event).public.siteUrl).origin
  return { ...result, items: result.items.map(({ object_key, ...asset }) => ({ ...asset, url: `${origin}/api/assets/${asset.id}` })) }
})
