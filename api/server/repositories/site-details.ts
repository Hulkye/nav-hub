import type { ContentDatabase } from './content'

export function createSiteDetailsRepository(db: ContentDatabase) {
  return {
    async publicSignals(siteId: string) {
      const result = await db.query<{ views: number; clicks: number; result_category: string | null; elapsed_ms: number | null; checked_at: Date | string | null; updated_at: Date | string }>(`
        SELECT s.updated_at, (SELECT count(*)::int FROM content_events e WHERE e.content_type = 'site' AND e.content_id = s.id AND e.event_type = 'view') AS views,
          (SELECT count(*)::int FROM content_events e WHERE e.content_type = 'site' AND e.content_id = s.id AND e.event_type = 'outbound_click') AS clicks,
          h.result_category, h.elapsed_ms, h.checked_at
        FROM sites s LEFT JOIN link_health_checks h ON h.content_type = 'site' AND h.content_id = s.id
          AND h.ignored_at IS NULL AND h.result_category NOT IN ('pending', 'ignored')
        WHERE s.id = $1 AND s.status = 'published'`, [siteId])
      const row = result.rows[0]
      if (!row) return undefined
      return {
        updated_at: row.updated_at,
        stats: { views: row.views, clicks: row.clicks },
        link_health: row.checked_at && row.result_category && row.result_category !== 'pending' && row.result_category !== 'ignored'
          ? { status: ['http_error', 'timeout', 'dns_error', 'unsafe_target', 'redirect_error', 'network_error'].includes(row.result_category) ? 'unavailable' : row.result_category === 'ok' && row.elapsed_ms !== null && row.elapsed_ms >= 2000 ? 'slow' : 'ok', checked_at: row.checked_at, elapsed_ms: row.elapsed_ms }
          : null
      }
    },
    async relatedSites(siteId: string) {
      return (await db.query(`SELECT s.id, s.title, s.slug, s.description, s.icon_url, s.target_url
        FROM sites s WHERE s.id <> $1 AND s.status = 'published'
        AND EXISTS (SELECT 1 FROM site_categories candidate
          JOIN site_categories source ON source.category_id = candidate.category_id
          JOIN sites origin ON origin.id = source.site_id AND origin.status = 'published'
          WHERE source.site_id = $1 AND candidate.site_id = s.id)
        ORDER BY s.sort_order, s.created_at DESC, s.id LIMIT 6`, [siteId])).rows
    },
    async relatedTagSites(siteId: string) {
      return (await db.query(`SELECT s.id, s.title, s.slug, s.description, s.icon_url, s.target_url, count(*)::int AS shared_tags
        FROM sites s JOIN site_tags candidate ON candidate.site_id = s.id
        JOIN site_tags source ON source.tag_id = candidate.tag_id AND source.site_id = $1
        WHERE s.id <> $1 AND s.status = 'published'
        GROUP BY s.id ORDER BY shared_tags DESC, s.title, s.id LIMIT 6`, [siteId])).rows
    }
  }
}
