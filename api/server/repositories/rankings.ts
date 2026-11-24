import { z } from 'zod'
import type { ContentDatabase } from './content'

export const rankingQuerySchema = z.object({ days: z.coerce.number().pipe(z.union([z.literal(7), z.literal(30)])).default(7) })

export function createRankingsRepository(db: ContentDatabase) {
  return {
    async list(days: 7 | 30) {
      rankingQuerySchema.parse({ days })
      const result = await db.query<{ id: string; title: string; slug: string; type: string; icon_url: string | null; target_url: string | null; views: number; clicks: number }>(`
        WITH content AS (
          SELECT id, title, slug, 'site' AS type, icon_url, target_url FROM sites WHERE status = 'published'
          UNION ALL SELECT id, title, slug, 'resource', cover_url, target_url FROM resources WHERE status = 'published'
          UNION ALL SELECT id, title, slug, 'media', cover_url, NULL FROM media_items WHERE status = 'published'
          UNION ALL SELECT id, title, slug, 'article', cover_url, NULL FROM articles WHERE status = 'published'
        )
        SELECT c.id, c.title, c.slug, c.type, c.icon_url, c.target_url,
          count(*) FILTER (WHERE e.event_type = 'view')::int AS views,
          count(*) FILTER (WHERE e.event_type = 'outbound_click')::int AS clicks
        FROM content c JOIN content_events e ON e.content_id = c.id AND e.content_type = c.type
        WHERE e.occurred_at >= now() - ($1::int * interval '1 day') AND e.occurred_at <= now()
        GROUP BY c.id, c.title, c.slug, c.type, c.icon_url, c.target_url
        ORDER BY count(*) DESC, c.type, c.id LIMIT 50`, [days])
      return result.rows
    }
  }
}
