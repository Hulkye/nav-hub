import { getContentRepository, getDiscoveryRepository } from '../../../utils/db'
import { publicEventDedupeKey } from '../../../utils/public-events'

export default defineEventHandler(async (event) => {
  const content = await getContentRepository().getPublishedContent('media', getRouterParam(event, 'slug')!)
  if (!content) throw createError({ statusCode: 404, message: '内容不存在', data: { code: 'CONTENT_NOT_FOUND' } })
  try { await getContentRepository().recordPublicEvent('view', 'media', String(content.id), publicEventDedupeKey(event)) } catch (error) { console.error('[analytics] failed to record media view', error) }
  const related = await getDiscoveryRepository().related('media', String(content.id))
  return { ...content, recommendations: related ?? [] }
})
