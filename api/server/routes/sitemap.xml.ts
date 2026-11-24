import { getContentRepository } from '../utils/db'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const sites = await getContentRepository().listSites(true)
  const urls = ['', '/search', '/submit', ...sites.map(site => `/sites/${site.slug}`)].map(path => `<url><loc>${config.public.siteUrl}${path}</loc></url>`).join('')
  setResponseHeader(event, 'content-type', 'application/xml; charset=utf-8')
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`
})
