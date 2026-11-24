import { z } from 'zod'
import { requireAdmin } from '../../../utils/auth'
import { getContentRepository } from '../../../utils/db'

export default defineEventHandler(async event => {
  await requireAdmin(event)
  const parsed = z.enum(['sites', 'resources', 'media', 'articles', 'announcements']).safeParse(getRouterParam(event, 'collection') ?? getRequestURL(event).pathname.split('/')[3])
  if (!parsed.success) throw createError({ statusCode: 404, message: '内容类型不存在' })
  return { batches: await getContentRepository().listImportBatches(parsed.data) }
})
