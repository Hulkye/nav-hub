import type { ContentDatabase } from './content'
import { createContentRepository } from './content'
import { publicSearchSchema, searchClickSchema, searchDiscoverySchema, searchRecordSchema, type SearchDiscoveryItem } from '../../../shared/schemas/search'
import { normalizeSearchTerm, searchAlternatives } from '../../../shared/utils/search-discovery'

const sources = [
  ['sites', 'site', 'slug', 'description'], ['resources', 'resource', 'slug', 'description'],
  ['media_items', 'media', 'slug', 'description'], ['articles', 'article', 'slug', 'summary'],
  ['announcements', 'announcement', 'id::text', 'body']
] as const

export function createSearchDiscoveryRepository(db: ContentDatabase) {
  const content = createContentRepository(db)
  async function candidates(type: string): Promise<SearchDiscoveryItem[]> {
    const source = sources.map(([table, kind, slug, description]) => `(SELECT id, title, ${slug} AS slug, left(${description}, 500) AS description, '${kind}' AS type, ${kind === 'site' ? 'icon_url' : kind === 'resource' || kind === 'media' ? 'cover_url' : kind === 'article' ? 'cover_url' : 'NULL::text'} AS icon_url, ${kind === 'site' || kind === 'resource' ? 'target_url' : 'NULL::text'} AS target_url FROM ${table}
      WHERE status = 'published' AND ($1 = 'all' OR $1 = '${kind}') ${kind === 'announcement' ? "AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now())" : ''}
      ORDER BY created_at DESC, id LIMIT 80)`).join(' UNION ALL ')
    return (await db.query<SearchDiscoveryItem & Record<string, unknown>>(source, [type])).rows
  }
  return {
    async search(raw: unknown) {
      const input = publicSearchSchema.parse(raw)
      const { q, ...options } = input
      const exact = await content.search(q, options)
      if (exact.total || input.q.length < 2) return exact
      const items = await candidates(input.type)
      for (const alternative of searchAlternatives(input.q, items.map(item => item.title))) {
        const result = await content.search(alternative, options)
        if (result.total) return { ...result, query: input.q, matchedQuery: alternative }
      }
      return exact
    },
    async discover(raw: unknown) {
      const input = searchDiscoverySchema.parse(raw)
      const items = await candidates(input.type)
      const titles = [...new Set(items.map(item => item.title).filter(title => title.length >= 2 && title.length <= 120))]
      const popularRows = await db.query<{ term: string }>(`SELECT term FROM search_discovery_terms WHERE updated_at > now() - interval '30 days' ORDER BY searches DESC, term LIMIT 2048`)
      const publicTitles = new Map(titles.map(title => [normalizeSearchTerm(title), title]))
      const popular = popularRows.rows.flatMap(row => publicTitles.get(row.term) ? [publicTitles.get(row.term)!] : []).slice(0, 8)
      const term = normalizeSearchTerm(input.q)
      const alternatives = searchAlternatives(input.q, titles)
      const suggestions = term.length >= 2 ? [...new Set([
        ...titles.filter(title => normalizeSearchTerm(title).includes(term)),
        ...titles.filter(title => alternatives.some(alternative => normalizeSearchTerm(title).includes(alternative))),
        ...alternatives
      ])].slice(0, 8) : []
      const [instant, categories, tags] = await Promise.all([
        input.q.length >= 2 ? this.search({ ...input, pageSize: 5 }) : null,
        db.query<{ id: string; name: string; slug: string; count: number }>(`SELECT c.id, c.name, c.slug, count(DISTINCT s.id)::int AS count FROM categories c LEFT JOIN site_categories sc ON sc.category_id = c.id LEFT JOIN sites s ON s.id = sc.site_id AND s.status = 'published' GROUP BY c.id ORDER BY count DESC, c.sort_order, c.name LIMIT 12`),
        db.query<{ name: string; slug: string; count: number }>(`SELECT t.name, t.slug, count(*)::int AS count FROM tags t JOIN (
          SELECT site_id AS content_id, tag_id FROM site_tags UNION ALL SELECT resource_id, tag_id FROM resource_tags UNION ALL SELECT media_id, tag_id FROM media_tags UNION ALL SELECT article_id, tag_id FROM article_tags
        ) links ON links.tag_id = t.id GROUP BY t.id ORDER BY count DESC, t.sort_order, t.name LIMIT 30`)
      ])
      return { popular, suggestions, results: instant?.results ?? [], recommendations: items.slice(0, 6), categories: categories.rows, tags: tags.rows }
    },
    async record(raw: unknown) {
      const input = searchRecordSchema.parse(raw)
      const term = normalizeSearchTerm(input.q)
      await db.query(`INSERT INTO search_discovery_terms (slot, term) VALUES ((hashtext($1)::bigint & 2147483647) % 2048, $1)
        ON CONFLICT (slot) DO UPDATE SET term = EXCLUDED.term,
        searches = CASE WHEN search_discovery_terms.term = EXCLUDED.term AND search_discovery_terms.updated_at > now() - interval '30 days' THEN LEAST(search_discovery_terms.searches + 1, 1000000) ELSE 1 END,
        updated_at = now()`, [term])
      await db.query(`INSERT INTO search_analytics (slot, term, content_type, searches, zero_results, clicks) VALUES ((hashtext($1)::bigint & 2147483647) % 4096, $1, $2, 1, CASE WHEN $3 = 0 THEN 1 ELSE 0 END, 0)
        ON CONFLICT (slot) DO UPDATE SET term = EXCLUDED.term, content_type = EXCLUDED.content_type,
        searches = CASE WHEN search_analytics.term = EXCLUDED.term AND search_analytics.content_type = EXCLUDED.content_type AND search_analytics.updated_at > now() - interval '30 days' THEN LEAST(search_analytics.searches + 1, 1000000) ELSE 1 END,
        zero_results = CASE WHEN search_analytics.term = EXCLUDED.term AND search_analytics.content_type = EXCLUDED.content_type AND search_analytics.updated_at > now() - interval '30 days' THEN search_analytics.zero_results + EXCLUDED.zero_results ELSE EXCLUDED.zero_results END,
        clicks = CASE WHEN search_analytics.term = EXCLUDED.term AND search_analytics.content_type = EXCLUDED.content_type AND search_analytics.updated_at > now() - interval '30 days' THEN search_analytics.clicks ELSE 0 END,
        updated_at = now()`, [term, input.type, input.resultCount])
    },
    async recordClick(raw: unknown) {
      const input = searchClickSchema.parse(raw)
      const term = normalizeSearchTerm(input.q)
      await db.query(`UPDATE search_analytics SET clicks = clicks + 1, updated_at = now()
        WHERE slot = (hashtext($1)::bigint & 2147483647) % 4096 AND term = $1 AND content_type = $2`, [term, input.type])
    }
  }
}
