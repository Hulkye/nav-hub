import { getContentRepository } from '../../../utils/db'
import { publicEventDedupeKey } from '../../../utils/public-events'

export default defineEventHandler(async (event) => {
  const content = await getContentRepository().getPublishedContent('announcements', getRouterParam(event, 'id')!)
  if (!content) throw createError({ statusCode: 404, message: '内容不存在', data: { code: 'CONTENT_NOT_FOUND' } })
  try { await getContentRepository().recordPublicEvent('view', 'announcement', String(content.id), publicEventDedupeKey(event)) } catch (error) { console.error('[analytics] failed to record announcement view', error) }
  return content
})
