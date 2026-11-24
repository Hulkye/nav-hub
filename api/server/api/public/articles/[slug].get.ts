import { getContentRepository, getDiscoveryRepository } from '../../../utils/db'
import { publicEventDedupeKey } from '../../../utils/public-events'

export default defineEventHandler(async (event) => {
  const content = await getContentRepository().getPublishedContent('articles', getRouterParam(event, 'slug')!)
  if (!content) throw createError({ statusCode: 404, message: '内容不存在', data: { code: 'CONTENT_NOT_FOUND' } })
  try { await getContentRepository().recordPublicEvent('view', 'article', String(content.id), publicEventDedupeKey(event)) } catch (error) { console.error('[analytics] failed to record article view', error) }
  const discovery = getDiscoveryRepository()
  const [related, navigation] = await Promise.all([
    discovery.related('article', String(content.id)),
    discovery.articleNavigation(String(content.id))
  ])
  return { ...content, recommendations: related ?? [], navigation }
})
