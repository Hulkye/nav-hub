import { getContentRepository } from '../utils/db'
import { renderRss } from '../utils/rss'

export default defineEventHandler(async event => {
  const items = await getContentRepository().listRssItems()
  const xml = renderRss(useRuntimeConfig(event).public.siteUrl, items)
  setResponseHeader(event, 'Content-Type', 'application/rss+xml; charset=utf-8')
  return xml
})
