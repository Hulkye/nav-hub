import { z } from 'zod'

export const searchSourceSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/),
  label: z.string().trim().min(1).max(40),
  enabled: z.boolean(),
  urlTemplate: z.string().trim().max(2048).refine(value => {
    if ((value.match(/\{query\}/g) ?? []).length !== 1 || /[\\\s\u0000-\u001f]/.test(value)) return false
    try {
      const url = new URL(value.replace('{query}', 'navhub-query'))
      return url.protocol === 'https:' && !url.username && !url.password && !url.host.includes('navhub-query') && (url.pathname.includes('navhub-query') || url.search.includes('navhub-query'))
    } catch { return false }
  }, '请输入不含凭据的 HTTPS 地址，并在路径或参数中包含一个 {query}')
}).strict()

export const defaultSearchSources = [
  { id: 'bing', label: 'Bing', enabled: true, urlTemplate: 'https://www.bing.com/search?q={query}' },
  { id: 'baidu', label: '百度', enabled: true, urlTemplate: 'https://www.baidu.com/s?wd={query}' },
  { id: 'github', label: 'GitHub', enabled: true, urlTemplate: 'https://github.com/search?q={query}' }
]

export function searchSourceUrl(template: string, query: string) {
  const source = searchSourceSchema.parse({ id: 'source', label: 'Source', enabled: true, urlTemplate: template })
  return source.urlTemplate.replace('{query}', encodeURIComponent(query))
}
