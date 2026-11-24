import { getContentRepository, getSiteDetailsRepository } from '../../../utils/db'
import { publicEventDedupeKey } from '../../../utils/public-events'

export default defineEventHandler(async (event) => {
  const site = await getContentRepository().getPublishedSite(getRouterParam(event, 'slug')!)
  if (!site) throw createError({ statusCode: 404, message: '网站不存在', data: { code: 'SITE_NOT_FOUND' } })
  try { await getContentRepository().recordPublicEvent('view', 'site', String(site.id), publicEventDedupeKey(event)) } catch (error) { console.error('[analytics] failed to record site view', error) }
  const details = getSiteDetailsRepository()
  const [signals, relatedSites, relatedTagSites] = await Promise.all([details.publicSignals(String(site.id)), details.relatedSites(String(site.id)), details.relatedTagSites(String(site.id))])
  return { ...site, ...signals, related_sites: relatedSites, related_tag_sites: relatedTagSites }
})
