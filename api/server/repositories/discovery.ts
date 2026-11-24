import { tagQuerySchema, tagSlugSchema, relatedQuerySchema, relatedTargetSchema, detailTagsTargetSchema } from '../../../shared/schemas/discovery'
import type { DiscoveryItem, PublicTag, TagContentPage, DetailTag, ArticleNavigation } from '../../../shared/types/discovery'
import type { ContentDatabase } from './content'

// All identifiers in these queries are fixed; client input is parameterized.
const publicContent = `
  SELECT id, 'site'::text AS type, title, slug, description AS summary, published_at, created_at FROM sites WHERE status = 'published'
  UNION ALL SELECT id, 'resource', title, slug, description, published_at, created_at FROM resources WHERE status = 'published'
  UNION ALL SELECT id, 'media', title, slug, description, published_at, created_at FROM media_items WHERE status = 'published'
  UNION ALL SELECT id, 'article', title, slug, summary, published_at, created_at FROM articles WHERE status = 'published'
  UNION ALL SELECT id, 'announcement', title, id::text, body, created_at, created_at FROM announcements
    WHERE status = 'published' AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now())`
const tagLinks = `
  SELECT site_id AS content_id, 'site'::text AS type, tag_id FROM site_tags
  UNION ALL SELECT resource_id, 'resource', tag_id FROM resource_tags
  UNION ALL SELECT media_id, 'media', tag_id FROM media_tags
  UNION ALL SELECT article_id, 'article', tag_id FROM article_tags
  UNION ALL SELECT announcement_id, 'announcement', tag_id FROM announcement_tags`
const publicTags = `WITH content AS (${publicContent}), links AS (${tagLinks})
  SELECT t.id, t.name, t.slug, t.description, count(*)::int AS count
  FROM tags t JOIN links l ON l.tag_id = t.id JOIN content c ON c.id = l.content_id AND c.type = l.type`

export function createDiscoveryRepository(db: ContentDatabase) {
  return {
    async detailTags(type: string, identifier: string) {
      const target = detailTagsTargetSchema.parse({ type, id: identifier })
      const match = target.type === 'site' ? 'c.slug = $2' : 'c.id = $2'
      const result = await db.query<{ tags: DetailTag[] }>(`WITH content AS (${publicContent}), links AS (${tagLinks})
        SELECT COALESCE((SELECT jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'slug', t.slug)
          ORDER BY t.sort_order, t.name, t.id)
          FROM tags t JOIN links l ON l.tag_id = t.id WHERE l.content_id = c.id AND l.type = c.type), '[]'::jsonb) AS tags
        FROM content c WHERE c.type = $1 AND ${match}`, [target.type, target.id])
      return result.rows[0]?.tags
    },
    async articleNavigation(id: string): Promise<ArticleNavigation | undefined> {
      relatedTargetSchema.parse({ type: 'article', id })
      // Previous is the nearest older article; next is the nearest newer one.
      const result = await db.query<ArticleNavigation & Record<string, unknown>>(`WITH published AS (
        SELECT id, title, slug, COALESCE(published_at, created_at) AS date FROM articles WHERE status = 'published'
      ) SELECT
        (SELECT jsonb_build_object('id', p.id, 'title', p.title, 'slug', p.slug) FROM published p
          WHERE (p.date, p.id) < (origin.date, origin.id) ORDER BY p.date DESC, p.id DESC LIMIT 1) AS previous,
        (SELECT jsonb_build_object('id', p.id, 'title', p.title, 'slug', p.slug) FROM published p
          WHERE (p.date, p.id) > (origin.date, origin.id) ORDER BY p.date, p.id LIMIT 1) AS next
        FROM published origin WHERE origin.id = $1`, [id])
      return result.rows[0]
    },
    async listTags() {
      return (await db.query<PublicTag & Record<string, unknown>>(`${publicTags}
        GROUP BY t.id ORDER BY t.sort_order, t.name, t.id`)).rows
    },
    async getTag(slug: string, rawOptions: { type?: unknown; page?: unknown; pageSize?: unknown } = {}): Promise<TagContentPage | undefined> {
      tagSlugSchema.parse(slug)
      const options = tagQuerySchema.parse(rawOptions)
      const tag = (await db.query<PublicTag & Record<string, unknown>>(`${publicTags}
        WHERE t.slug = $1 GROUP BY t.id`, [slug])).rows[0]
      if (!tag) return undefined
      const filter = `FROM content c JOIN links l ON l.content_id = c.id AND l.type = c.type
        WHERE l.tag_id = $1 AND ($2 = 'all' OR c.type = $2)`
      const parameters = [tag.id, options.type]
      const total = (await db.query<{ total: number }>(`WITH content AS (${publicContent}), links AS (${tagLinks})
        SELECT count(*)::int AS total ${filter}`, parameters)).rows[0]!.total
      const results = (await db.query<DiscoveryItem & Record<string, unknown>>(`WITH content AS (${publicContent}), links AS (${tagLinks})
        SELECT c.id, c.type, c.title, c.slug, c.summary, c.published_at ${filter}
        ORDER BY COALESCE(c.published_at, c.created_at) DESC, c.type, c.id LIMIT $3 OFFSET $4`,
      [...parameters, options.pageSize, (options.page - 1) * options.pageSize])).rows
      return { tag, results, total, page: options.page, pageSize: options.pageSize }
    },
    async related(type: string, id: string, limit = 6) {
      relatedTargetSchema.parse({ type, id })
      relatedQuerySchema.parse({ limit })
      const result = await db.query<{ results: DiscoveryItem[] }>(`
        WITH content AS NOT MATERIALIZED (${publicContent}), links AS (${tagLinks}), ranked AS (
          SELECT c.id, c.type, c.title, c.slug, c.summary, c.published_at,
            COALESCE(c.published_at, c.created_at) AS sort_date, count(*)::int AS shared_tags
          FROM content c JOIN links candidate ON candidate.content_id = c.id AND candidate.type = c.type
          JOIN links source ON source.tag_id = candidate.tag_id AND source.content_id = $2 AND source.type = $1
          WHERE c.type <> 'announcement' AND c.type <> $1
          GROUP BY c.id, c.type, c.title, c.slug, c.summary, c.published_at, c.created_at
          ORDER BY shared_tags DESC, sort_date DESC, c.type, c.id LIMIT $3
        )
        SELECT COALESCE((SELECT jsonb_agg(to_jsonb(ranked) - 'sort_date'
          ORDER BY shared_tags DESC, sort_date DESC, type, id) FROM ranked), '[]'::jsonb) AS results
        FROM content WHERE type = $1 AND id = $2`, [type, id, limit])
      return result.rows[0]?.results
    }
  }
}
