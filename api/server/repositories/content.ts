import { z } from 'zod'
import { commentSchema, reportSchema, siteSchema, submissionSchema, type CommentInput, type ReportInput, type SubmissionInput } from '../../../shared/schemas/content'
import { adminContentSchemas, contentIdSchema, type AdminContentCollection } from '../../../shared/schemas/admin-content'
import { publicSearchSchema } from '../../../shared/schemas/search'
import { enrichmentValues } from './content-enrichment'

const commentTargetTables = { site: 'sites', resource: 'resources', media: 'media_items', article: 'articles' } as const

export interface ContentDatabase {
  query<T extends Record<string, unknown>>(sql: string, parameters?: unknown[]): Promise<{ rows: T[] }>
  transaction<T>(callback: (database: ContentDatabase) => Promise<T>): Promise<T>
}

export type PublicCollection = 'resources' | 'media' | 'articles' | 'announcements'
export type PublicEventType = 'view' | 'outbound_click'

const homepageModuleTypes = ['featured', 'latest', 'category', 'announcement'] as const

const publicCollections = {
  resources: { table: 'resources', fields: 'id, title, slug, description, resource_type, cover_url, target_url, published_at, platforms, version, screenshots, download_sources, version_history', key: 'slug', tagTable: 'resource_tags', contentId: 'resource_id', categoryTable: 'resource_categories', categoryId: 'resource_id' },
  media: { table: 'media_items', fields: 'id, title, slug, description, media_type, cover_url, rating, published_at, author, director, publisher, release_date, channels', key: 'slug', tagTable: 'media_tags', contentId: 'media_id', categoryTable: 'media_categories', categoryId: 'media_id' },
  articles: { table: 'articles', fields: 'id, title, slug, summary, body, cover_url, published_at', key: 'slug', tagTable: 'article_tags', contentId: 'article_id', categoryTable: 'article_categories', categoryId: 'article_id' },
  announcements: { table: 'announcements', fields: 'id, title, body, target_url, starts_at, ends_at, created_at', key: 'id::text', tagTable: 'announcement_tags', contentId: 'announcement_id' }
} as const

// Column names come only from this allowlist; user values always use query parameters.
const adminColumns = {
  resources: { title: 'title', slug: 'slug', description: 'description', resourceType: 'resource_type', coverUrl: 'cover_url', targetUrl: 'target_url', status: 'status' },
  media: { title: 'title', slug: 'slug', description: 'description', mediaType: 'media_type', coverUrl: 'cover_url', rating: 'rating', status: 'status' },
  articles: { title: 'title', slug: 'slug', summary: 'summary', body: 'body', coverUrl: 'cover_url', status: 'status' },
  announcements: { title: 'title', body: 'body', targetUrl: 'target_url', startsAt: 'starts_at', endsAt: 'ends_at', status: 'status' }
} as const

function contentValues(collection: AdminContentCollection, raw: unknown) {
  const input = adminContentSchemas[collection].parse(raw) as Record<string, unknown>
  return {
    values: [...Object.entries(adminColumns[collection]).map(([key, column]) => ({ column, value: input[key] })), ...enrichmentValues(collection, input)],
    tagIds: input.tagIds as string[]
  }
}

const activeAnnouncement = "status = 'published' AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now())"
const pageSchema = z.coerce.number().int().min(1).default(1)
const pageSizeSchema = z.coerce.number().int().min(1).max(100).default(20)
const statusSchema = z.enum(['draft', 'published', 'offline']).optional()
const searchSchema = z.string().trim().max(120).default('')

function adminListOptions(raw: { page?: unknown; pageSize?: unknown; status?: unknown; q?: unknown }) {
  return {
    page: pageSchema.parse(raw.page),
    pageSize: pageSizeSchema.parse(raw.pageSize),
    status: statusSchema.parse(raw.status),
    q: searchSchema.parse(raw.q)
  }
}

export function createContentRepository(db: ContentDatabase) {
  return {
    async getLinkScheduleStatus() {
      const runs = await db.query('SELECT id, started_at, completed_at, checked_count, failed_count, status FROM link_health_schedule_runs ORDER BY started_at DESC LIMIT 5')
      const failures = await db.query<{ total: number; longstanding: number }>("SELECT count(*)::int AS total, count(*) FILTER (WHERE h.checked_at < now() - interval '7 days')::int AS longstanding FROM link_health_checks h WHERE h.ignored_at IS NULL AND h.result_category NOT IN ('ok', 'pending', 'ignored') AND (EXISTS (SELECT 1 FROM sites WHERE id = h.content_id AND h.content_type = 'site' AND status = 'published') OR EXISTS (SELECT 1 FROM resources WHERE id = h.content_id AND h.content_type = 'resource' AND status = 'published'))")
      return { runs: runs.rows, failures: failures.rows[0] }
    },
    async listRssItems(limit = 50) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('INVALID_RSS_LIMIT')
      const result = await db.query<{ content_type: 'site' | 'resource' | 'media' | 'article'; slug: string; title: string; summary: string; published_at: Date | string | null }>(`
        SELECT * FROM (
          SELECT 'site' AS content_type, slug, title, description AS summary, published_at FROM sites WHERE status = 'published'
          UNION ALL SELECT 'resource', slug, title, description, published_at FROM resources WHERE status = 'published'
          UNION ALL SELECT 'media', slug, title, description, published_at FROM media_items WHERE status = 'published'
          UNION ALL SELECT 'article', slug, title, summary, published_at FROM articles WHERE status = 'published'
        ) published_content
        ORDER BY published_at DESC NULLS LAST, content_type, slug LIMIT $1`, [limit])
      return result.rows
    },
    async recordPublicEvent(eventType: PublicEventType, contentType: 'site' | 'resource' | 'media' | 'article' | 'announcement', contentId: string, dedupeKey: string) {
      await db.query(`INSERT INTO content_events (event_type, content_type, content_id, dedupe_key) VALUES ($1, $2, $3, $4) ON CONFLICT (event_type, content_type, content_id, dedupe_key) DO NOTHING`, [eventType, contentType, contentId, dedupeKey])
    },
    async getOutboundTarget(id: string) {
      const result = await db.query<{ id: string; content_type: 'site' | 'resource' | 'announcement'; target_url: string }>(`SELECT id, 'site' AS content_type, target_url FROM sites WHERE id = $1 AND status = 'published' AND target_url IS NOT NULL UNION ALL SELECT id, 'resource', target_url FROM resources WHERE id = $1 AND status = 'published' AND target_url IS NOT NULL UNION ALL SELECT id, 'announcement', target_url FROM announcements WHERE id = $1 AND status = 'published' AND target_url IS NOT NULL AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now()) LIMIT 1`, [id])
      return result.rows[0]
    },
    async getEventStats(start: Date, end: Date) {
      const totals = await db.query<{ event_type: PublicEventType; count: number }>(`SELECT event_type, count(*)::int AS count FROM content_events WHERE occurred_at >= $1 AND occurred_at < $2 GROUP BY event_type`, [start.toISOString(), end.toISOString()])
      const details = await db.query(`SELECT e.event_type, e.content_type, e.content_id, e.count, COALESCE(s.title, r.title, m.title, a.title, n.title) AS title FROM (SELECT event_type, content_type, content_id, count(*)::int AS count FROM content_events WHERE occurred_at >= $1 AND occurred_at < $2 GROUP BY event_type, content_type, content_id ORDER BY count DESC, content_type, content_id LIMIT 100) e LEFT JOIN sites s ON e.content_type = 'site' AND s.id = e.content_id LEFT JOIN resources r ON e.content_type = 'resource' AND r.id = e.content_id LEFT JOIN media_items m ON e.content_type = 'media' AND m.id = e.content_id LEFT JOIN articles a ON e.content_type = 'article' AND a.id = e.content_id LEFT JOIN announcements n ON e.content_type = 'announcement' AND n.id = e.content_id`, [start.toISOString(), end.toISOString()])
      return { totals: totals.rows, items: details.rows }
    },
    async listHomepageModules(admin = false) {
      const result = await db.query(`SELECT id, module_type, title, enabled, sort_order, item_limit, category_id, content_ids, created_at, updated_at FROM homepage_modules ${admin ? '' : 'WHERE enabled = true'} ORDER BY sort_order, id`)
      return result.rows
    },
    async listLinkHealthChecks(options: { failedOnly?: boolean; includeIgnored?: boolean } = {}) {
      const failedFilter = options.failedOnly ? "h.result_category IN ('http_error', 'timeout', 'dns_error', 'unsafe_target', 'redirect_error', 'network_error')" : 'true'
      const ignoredFilter = options.includeIgnored ? 'true' : 'h.ignored_at IS NULL'
      const result = await db.query(`SELECT c.id, c.title, c.slug, c.target_url, c.content_type, c.status, h.checked_at, h.result_category, h.status_code, h.error_summary, h.elapsed_ms, h.ignored_at FROM (SELECT id, title, slug, target_url, 'site' AS content_type, status FROM sites UNION ALL SELECT id, title, slug, target_url, 'resource', status FROM resources WHERE target_url IS NOT NULL) c LEFT JOIN link_health_checks h ON h.content_type = c.content_type AND h.content_id = c.id WHERE c.status = 'published' AND ${failedFilter} AND ${ignoredFilter} ORDER BY (h.result_category = 'pending') DESC NULLS LAST, h.checked_at ASC NULLS FIRST, c.title LIMIT 500`)
      return result.rows
    },
    async beginLinkHealthCheck(ids: string[], adminId: string, retryFailed = false) {
      if (!ids.length || ids.length > 100) throw new Error('INVALID_LINK_CHECK_SIZE')
      const contentIds = [...new Set(ids.map(id => contentIdSchema.parse(id)))]
      return db.transaction(async tx => {
        const selected = await tx.query(`SELECT id, 'site' AS content_type FROM sites WHERE id = ANY($1::uuid[]) AND status = 'published' UNION ALL SELECT id, 'resource' FROM resources WHERE id = ANY($1::uuid[]) AND status = 'published'`, [contentIds])
        const accepted: Array<{ id: string; content_type: string }> = []
        for (const item of selected.rows as Array<{ id: string; content_type: string }>) {
          const current = await tx.query<{ result_category: string | null; ignored_at: string | null; checked_at: string | null }>('SELECT result_category, ignored_at, checked_at FROM link_health_checks WHERE content_type = $1 AND content_id = $2 FOR UPDATE', [item.content_type, item.id])
          if (current.rows[0]?.ignored_at) continue
          if (current.rows[0]?.result_category === 'pending' && current.rows[0].checked_at && Date.now() - new Date(current.rows[0].checked_at).getTime() < 10 * 60 * 1000) continue
          if (retryFailed && current.rows[0] && ['ok', 'pending'].includes(String(current.rows[0].result_category))) continue
          await tx.query(`INSERT INTO link_health_checks (content_type, content_id, result_category, error_summary, ignored_at, checked_at, updated_at) VALUES ($1, $2, 'pending', NULL, NULL, now(), now()) ON CONFLICT (content_type, content_id) DO UPDATE SET result_category = 'pending', error_summary = NULL, checked_at = now(), updated_at = now()`, [item.content_type, item.id])
          accepted.push(item)
        }
        await tx.query('INSERT INTO admin_audit_logs (admin_id, action, resource) VALUES ($1, $2, $3)', [adminId, retryFailed ? 'retry' : 'check', 'link_health'])
        return accepted
      })
    },
    async failQueuedLinkHealthCheck(contentType: 'site' | 'resource', id: string, summary: string) {
      await db.query("UPDATE link_health_checks SET result_category = 'network_error', error_summary = $3, updated_at = now() WHERE content_type = $1 AND content_id = $2 AND result_category = 'pending'", [contentType, id, summary])
    },
    async getPublishedLinkTarget(contentType: 'site' | 'resource', id: string) {
      const table = contentType === 'site' ? 'sites' : 'resources'
      const result = await db.query<{ target_url: string }>(`SELECT target_url FROM ${table} WHERE id = $1 AND status = 'published'`, [contentIdSchema.parse(id)])
      return result.rows[0]?.target_url
    },
    async finishLinkHealthCheck(contentType: 'site' | 'resource', id: string, result: { category: string; statusCode: number | null; summary: string | null; elapsedMs: number }) {
      await db.query('UPDATE link_health_checks SET result_category = $3, status_code = $4, error_summary = $5, elapsed_ms = $6, updated_at = now() WHERE content_type = $1 AND content_id = $2', [contentType, id, result.category, result.statusCode, result.summary, result.elapsedMs])
    },
    async setLinkHealthIgnored(contentType: 'site' | 'resource', id: string, ignored: boolean, adminId: string) {
      const table = contentType === 'site' ? 'sites' : 'resources'
      return db.transaction(async tx => {
        const target = await tx.query(`SELECT id FROM ${table} WHERE id = $1 AND status = 'published'`, [contentIdSchema.parse(id)])
        if (!target.rows[0]) return false
        if (ignored) await tx.query(`INSERT INTO link_health_checks (content_type, content_id, result_category, error_summary, ignored_at) VALUES ($1, $2, 'ignored', NULL, now()) ON CONFLICT (content_type, content_id) DO UPDATE SET ignored_at = now(), updated_at = now()`, [contentType, id])
        else await tx.query('UPDATE link_health_checks SET ignored_at = NULL, updated_at = now() WHERE content_type = $1 AND content_id = $2', [contentType, id])
        await tx.query('INSERT INTO admin_audit_logs (admin_id, action, resource, resource_id) VALUES ($1, $2, $3, $4)', [adminId, ignored ? 'ignore' : 'unignore', 'link_health', id])
        return true
      })
    },
    async replaceHomepageModules(modules: Array<{ moduleType: typeof homepageModuleTypes[number]; title: string; enabled: boolean; sortOrder: number; itemLimit: number; categoryId: string | null; contentIds: string[] }>, adminId: string) {
      return db.transaction(async tx => {
        await tx.query('DELETE FROM homepage_modules')
        const rows = []
        for (const module of modules) {
          const result = await tx.query(`INSERT INTO homepage_modules (module_type, title, enabled, sort_order, item_limit, category_id, content_ids) VALUES ($1, $2, $3, $4, $5, $6, $7::uuid[]) RETURNING id, module_type, title, enabled, sort_order, item_limit, category_id, content_ids`, [module.moduleType, module.title, module.enabled, module.sortOrder, module.itemLimit, module.categoryId, module.contentIds])
          rows.push(result.rows[0])
        }
        await tx.query('INSERT INTO admin_audit_logs (admin_id, action, resource) VALUES ($1, $2, $3)', [adminId, 'replace', 'homepage_modules'])
        return rows
      })
    },
    async renderHomepageModules() {
      const modules = await this.listHomepageModules()
      const rendered: Array<Record<string, unknown>> = []
      for (const module of modules) {
        const limit = Number(module.item_limit)
        let items: Record<string, unknown>[] = []
        if (module.module_type === 'announcement') items = (await this.listPublishedContent('announcements')).slice(0, limit)
        if (module.module_type === 'latest') items = (await this.listSites(true)).slice(0, limit)
        if (module.module_type === 'category' && module.category_id) {
          const result = await db.query(`SELECT s.id, s.title, s.slug, s.description, s.target_url, s.icon_url FROM sites s JOIN site_categories sc ON sc.site_id = s.id LEFT JOIN site_category_settings settings ON settings.site_id = s.id AND settings.category_id = $1 WHERE sc.category_id = $1 AND s.status = 'published' ORDER BY COALESCE(settings.pinned, false) DESC, COALESCE(settings.sort_order, 999999), s.sort_order, s.created_at DESC, s.id LIMIT $2`, [module.category_id, limit])
          items = result.rows
        }
        if (module.module_type === 'featured' && Array.isArray(module.content_ids) && module.content_ids.length) {
          const result = await db.query(`SELECT id, title, slug, description, target_url, icon_url FROM sites WHERE status = 'published' AND id = ANY($1::uuid[]) ORDER BY array_position($1::uuid[], id) LIMIT $2`, [module.content_ids, limit])
          items = result.rows
        }
        rendered.push({ ...module, items })
      }
      return rendered
    },
    async listSites(publishedOnly = false) {
      const result = await db.query(`SELECT s.id, s.title, s.slug, s.description, s.target_url, s.backup_url, s.preview_url, s.icon_url, s.status, s.sort_order, s.published_at, s.created_at, s.updated_at, COALESCE(ARRAY(SELECT sc.category_id FROM site_categories sc WHERE sc.site_id = s.id), ARRAY[]::uuid[]) AS category_ids FROM sites s ${publishedOnly ? "WHERE s.status = 'published'" : ''} ORDER BY s.sort_order, s.created_at DESC, s.id`)
      return result.rows
    },
    async listAdminSites(rawOptions: { page?: unknown; pageSize?: unknown; status?: unknown; q?: unknown; categoryId?: unknown; qualityIssue?: unknown } = {}) {
      const options = adminListOptions(rawOptions)
      const categoryId = rawOptions.categoryId == null || rawOptions.categoryId === '' ? undefined : contentIdSchema.parse(rawOptions.categoryId)
      const filters: string[] = []
      const parameters: unknown[] = []
      if (options.status) { parameters.push(options.status); filters.push(`s.status = $${parameters.length}`) }
      if (options.q) { parameters.push(`%${options.q}%`); filters.push(`(s.title ILIKE $${parameters.length} OR s.slug ILIKE $${parameters.length} OR s.description ILIKE $${parameters.length} OR s.target_url ILIKE $${parameters.length})`) }
      if (categoryId) { parameters.push(categoryId); filters.push(`EXISTS (SELECT 1 FROM site_categories filter_sc WHERE filter_sc.site_id = s.id AND filter_sc.category_id = $${parameters.length})`) }
      const qualityIssue = z.enum(['missing_description', 'missing_category', 'broken_url', 'duplicate_site']).optional().parse(rawOptions.qualityIssue)
      if (qualityIssue === 'missing_description') filters.push("btrim(s.description) = ''")
      if (qualityIssue === 'missing_category') filters.push('NOT EXISTS (SELECT 1 FROM site_categories quality_sc WHERE quality_sc.site_id = s.id)')
      if (qualityIssue === 'broken_url') filters.push("EXISTS (SELECT 1 FROM link_health_checks quality_h WHERE quality_h.content_type = 'site' AND quality_h.content_id = s.id AND quality_h.ignored_at IS NULL AND quality_h.result_category IN ('http_error', 'timeout', 'dns_error', 'unsafe_target', 'redirect_error', 'network_error'))")
      if (qualityIssue === 'duplicate_site') filters.push("EXISTS (SELECT 1 FROM sites duplicate WHERE duplicate.status = 'published' AND duplicate.id <> s.id AND regexp_replace(regexp_replace(lower(duplicate.target_url), '^https?://(www\\.)?', ''), '/$', '') = regexp_replace(regexp_replace(lower(s.target_url), '^https?://(www\\.)?', ''), '/$', ''))")
      const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
      const count = await db.query<{ total: number }>(`SELECT count(*)::int AS total FROM sites s ${where}`, parameters)
      parameters.push(options.pageSize, (options.page - 1) * options.pageSize)
      const result = await db.query(`SELECT s.id, s.title, s.slug, s.description, s.target_url, s.backup_url, s.preview_url, s.icon_url, s.status, s.sort_order, s.published_at, s.created_at, s.updated_at, COALESCE(ARRAY(SELECT sc.category_id FROM site_categories sc WHERE sc.site_id = s.id), ARRAY[]::uuid[]) AS category_ids, EXISTS (SELECT 1 FROM link_health_checks quality_h WHERE quality_h.content_type = 'site' AND quality_h.content_id = s.id AND quality_h.ignored_at IS NULL AND quality_h.result_category IN ('http_error', 'timeout', 'dns_error', 'unsafe_target', 'redirect_error', 'network_error')) AS link_health_failed, EXISTS (SELECT 1 FROM sites duplicate WHERE duplicate.status = 'published' AND duplicate.id <> s.id AND regexp_replace(regexp_replace(lower(duplicate.target_url), '^https?://(www\\.)?', ''), '/$', '') = regexp_replace(regexp_replace(lower(s.target_url), '^https?://(www\\.)?', ''), '/$', '')) AS duplicate_site FROM sites s ${where} ORDER BY s.sort_order, s.created_at DESC, s.id LIMIT $${parameters.length - 1} OFFSET $${parameters.length}`, parameters)
      const total = count.rows[0]?.total ?? 0
      return { items: result.rows, total, page: options.page, pageSize: options.pageSize, pageCount: Math.ceil(total / options.pageSize) }
    },
    async getAdminSite(id: string) {
      const siteId = contentIdSchema.parse(id)
      const result = await db.query(`SELECT s.*, COALESCE(ARRAY(SELECT category_id FROM site_categories WHERE site_id = s.id), ARRAY[]::uuid[]) AS category_ids, COALESCE(ARRAY(SELECT tag_id FROM site_tags WHERE site_id = s.id), ARRAY[]::uuid[]) AS tag_ids FROM sites s WHERE s.id = $1`, [siteId])
      return result.rows[0]
    },
    async getPublishedSite(slug: string) {
      const result = await db.query(`SELECT id, title, slug, description, body, target_url, backup_url, preview_url, icon_url, status, published_at FROM sites WHERE slug = $1 AND status = 'published'`, [slug])
      return result.rows[0]
    },
    async listPublicCategories() {
      const result = await db.query(`SELECT c.id, c.name, c.slug, c.description, c.icon_name, c.parent_id, c.sort_order, count(DISTINCT s.id)::int AS site_count FROM categories c LEFT JOIN site_categories sc ON sc.category_id = c.id LEFT JOIN sites s ON s.id = sc.site_id AND s.status = 'published' GROUP BY c.id ORDER BY c.sort_order, c.name`)
      return result.rows
    },
    async getCategory(slug: string) {
      const category = await db.query('SELECT id, name, slug, description FROM categories WHERE slug = $1', [slug])
      if (!category.rows[0]) return undefined
      const sites = await db.query(`SELECT s.id, s.title, s.slug, s.description, s.target_url, s.icon_url FROM sites s JOIN site_categories sc ON sc.site_id = s.id WHERE sc.category_id = $1 AND s.status = 'published' ORDER BY s.sort_order, s.created_at DESC`, [category.rows[0].id])
      return { ...category.rows[0], sites: sites.rows }
    },
    async listPublishedContent(collection: PublicCollection) {
      const { table, fields, tagTable, contentId } = publicCollections[collection]
      const filter = collection === 'announcements' ? activeAnnouncement : "status = 'published'"
      const categoryFields = collection === 'announcements' ? 'ARRAY[]::uuid[]' : `COALESCE(ARRAY(SELECT category_id FROM ${publicCollections[collection].categoryTable} WHERE ${publicCollections[collection].categoryId} = content.id), ARRAY[]::uuid[])`
      const result = await db.query(`SELECT ${fields}, COALESCE(ARRAY(SELECT tag_id FROM ${tagTable} WHERE ${contentId} = content.id), ARRAY[]::uuid[]) AS tag_ids, ${categoryFields} AS category_ids FROM ${table} content WHERE ${filter} ORDER BY created_at DESC LIMIT 100`)
      return result.rows
    },
    async getPublishedContent(collection: PublicCollection, identifier: string) {
      const { table, fields, key, tagTable, contentId } = publicCollections[collection]
      const filter = collection === 'announcements' ? activeAnnouncement : "status = 'published'"
      const categoryFields = collection === 'announcements' ? 'ARRAY[]::uuid[]' : `COALESCE(ARRAY(SELECT category_id FROM ${publicCollections[collection].categoryTable} WHERE ${publicCollections[collection].categoryId} = content.id), ARRAY[]::uuid[])`
      const result = await db.query(`SELECT ${fields}, COALESCE(ARRAY(SELECT tag_id FROM ${tagTable} WHERE ${contentId} = content.id), ARRAY[]::uuid[]) AS tag_ids, ${categoryFields} AS category_ids FROM ${table} content WHERE ${key} = $1 AND ${filter}`, [identifier])
      return result.rows[0]
    },
    async listAdminContent(collection: AdminContentCollection, rawOptions?: { page?: unknown; pageSize?: unknown; status?: unknown; q?: unknown }) {
      if (!rawOptions) {
        const result = await db.query(`SELECT * FROM ${publicCollections[collection].table} ORDER BY created_at DESC`)
        return result.rows
      }
      const options = adminListOptions(rawOptions)
      const columns = collection === 'announcements' ? ['title', 'body'] : collection === 'resources' || collection === 'media' ? ['title', 'slug', 'description'] : ['title', 'slug', 'summary', 'body']
      const filters: string[] = []
      const parameters: unknown[] = []
      if (options.status) { parameters.push(options.status); filters.push(`status = $${parameters.length}`) }
      if (options.q) { parameters.push(`%${options.q}%`); filters.push(`(${columns.map(column => `${column} ILIKE $${parameters.length}`).join(' OR ')})`) }
      const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
      const table = publicCollections[collection].table
      const count = await db.query<{ total: number }>(`SELECT count(*)::int AS total FROM ${table} ${where}`, parameters)
      parameters.push(options.pageSize, (options.page - 1) * options.pageSize)
      const { tagTable, contentId } = publicCollections[collection]
      const filteredWhere = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
      const result = await db.query(`SELECT item.*, COALESCE(ARRAY(SELECT tag_id FROM ${tagTable} WHERE ${contentId} = item.id), ARRAY[]::uuid[]) AS tag_ids FROM ${table} item ${filteredWhere} ORDER BY item.created_at DESC, item.id LIMIT $${parameters.length - 1} OFFSET $${parameters.length}`, parameters)
      const total = count.rows[0]?.total ?? 0
      return { items: result.rows, total, page: options.page, pageSize: options.pageSize, pageCount: Math.ceil(total / options.pageSize) }
    },
    async exportAdminContent(collection: AdminContentCollection | 'sites', siteOptions?: { q?: string; status?: string; categoryId?: string; qualityIssue?: string }) {
      if (collection === 'sites') {
        const filters: string[] = []
        const parameters: unknown[] = []
        if (siteOptions?.status) { parameters.push(siteOptions.status); filters.push(`s.status = $${parameters.length}`) }
        if (siteOptions?.q) { parameters.push(`%${siteOptions.q}%`); filters.push(`(s.title ILIKE $${parameters.length} OR s.slug ILIKE $${parameters.length} OR s.description ILIKE $${parameters.length} OR s.target_url ILIKE $${parameters.length})`) }
        if (siteOptions?.categoryId) { parameters.push(contentIdSchema.parse(siteOptions.categoryId)); filters.push(`EXISTS (SELECT 1 FROM site_categories filter_sc WHERE filter_sc.site_id = s.id AND filter_sc.category_id = $${parameters.length})`) }
        const qualityIssue = siteOptions?.qualityIssue
        if (qualityIssue === 'missing_description') filters.push("btrim(s.description) = ''")
        if (qualityIssue === 'missing_category') filters.push('NOT EXISTS (SELECT 1 FROM site_categories quality_sc WHERE quality_sc.site_id = s.id)')
        if (qualityIssue === 'broken_url') filters.push("EXISTS (SELECT 1 FROM link_health_checks quality_h WHERE quality_h.content_type = 'site' AND quality_h.content_id = s.id AND quality_h.ignored_at IS NULL AND quality_h.result_category IN ('http_error', 'timeout', 'dns_error', 'unsafe_target', 'redirect_error', 'network_error'))")
        if (qualityIssue === 'duplicate_site') filters.push("EXISTS (SELECT 1 FROM sites duplicate WHERE duplicate.status = 'published' AND duplicate.id <> s.id AND regexp_replace(regexp_replace(lower(duplicate.target_url), '^https?://(www\\.)?', ''), '/$', '') = regexp_replace(regexp_replace(lower(s.target_url), '^https?://(www\\.)?', ''), '/$', ''))")
        const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
        const result = await db.query(`SELECT s.title, s.slug, s.description, s.body, s.target_url, s.backup_url, s.preview_url, s.icon_url, s.sort_order, s.status, COALESCE(ARRAY(SELECT category_id FROM site_categories WHERE site_id = s.id), ARRAY[]::uuid[]) AS category_ids, COALESCE(ARRAY(SELECT tag_id FROM site_tags WHERE site_id = s.id), ARRAY[]::uuid[]) AS tag_ids FROM sites s ${where} ORDER BY s.created_at, s.id LIMIT 1001`, parameters)
        if (result.rows.length > 1000) throw new Error('EXPORT_LIMIT_EXCEEDED')
        return result.rows
      }
      const { table, tagTable, contentId } = publicCollections[collection]
      const result = await db.query(`SELECT item.*, COALESCE(ARRAY(SELECT tag_id FROM ${tagTable} WHERE ${contentId} = item.id), ARRAY[]::uuid[]) AS tag_ids FROM ${table} item ORDER BY item.created_at, item.id LIMIT 1001`)
      if (result.rows.length > 1000) throw new Error('EXPORT_LIMIT_EXCEEDED')
      return result.rows
    },
    async bulkUpdateSiteTaxonomy(ids: string[], categoryIds: string[], tagIds: string[], adminId: string) {
      if (!ids.length || ids.length > 100) throw new Error('INVALID_BULK_SIZE')
      const siteIds = [...new Set(ids.map(id => contentIdSchema.parse(id)))]
      const categories = [...new Set(categoryIds.map(id => contentIdSchema.parse(id)))]
      const tags = [...new Set(tagIds.map(id => contentIdSchema.parse(id)))]
      return db.transaction(async tx => {
        const found = await tx.query<{ id: string }>('SELECT id FROM sites WHERE id = ANY($1::uuid[])', [siteIds])
        if (found.rows.length !== siteIds.length) throw new Error('SITES_NOT_FOUND')
        await tx.query('DELETE FROM site_categories WHERE site_id = ANY($1::uuid[])', [siteIds])
        await tx.query('DELETE FROM site_tags WHERE site_id = ANY($1::uuid[])', [siteIds])
        if (categories.length) await tx.query('INSERT INTO site_categories (site_id, category_id) SELECT site_ids.site_id, category_ids.category_id FROM unnest($1::uuid[]) AS site_ids(site_id) CROSS JOIN unnest($2::uuid[]) AS category_ids(category_id)', [siteIds, categories])
        if (tags.length) await tx.query('INSERT INTO site_tags (site_id, tag_id) SELECT site_ids.site_id, tag_ids.tag_id FROM unnest($1::uuid[]) AS site_ids(site_id) CROSS JOIN unnest($2::uuid[]) AS tag_ids(tag_id)', [siteIds, tags])
        for (const id of siteIds) await tx.query('INSERT INTO admin_audit_logs (admin_id, action, resource, resource_id) VALUES ($1, $2, $3, $4)', [adminId, 'bulk_taxonomy', 'site', id])
        return siteIds
      })
    },
    async replaceSiteDomains(ids: string[], oldHost: string, newHost: string, adminId: string) {
      if (!ids.length || ids.length > 100) throw new Error('INVALID_BULK_SIZE')
      const siteIds = [...new Set(ids.map(id => contentIdSchema.parse(id)))]
      return db.transaction(async tx => {
        const sites = await tx.query<{ id: string; target_url: string; backup_url: string | null; preview_url: string | null }>('SELECT id, target_url, backup_url, preview_url FROM sites WHERE id = ANY($1::uuid[]) FOR UPDATE', [siteIds])
        if (sites.rows.length !== siteIds.length) throw new Error('SITES_NOT_FOUND')
        const replace = (value: string | null) => {
          if (!value) return value
          const url = new URL(value)
          if (url.hostname.toLowerCase() !== oldHost.toLowerCase()) return value
          url.hostname = newHost
          return url.toString()
        }
        for (const site of sites.rows) {
          await tx.query('UPDATE sites SET target_url = $2, backup_url = $3, preview_url = $4, updated_at = now() WHERE id = $1', [site.id, replace(site.target_url), replace(site.backup_url), replace(site.preview_url)])
          await tx.query('INSERT INTO admin_audit_logs (admin_id, action, resource, resource_id) VALUES ($1, $2, $3, $4)', [adminId, 'replace_domain', 'site', site.id])
        }
        return { updated: sites.rows.length }
      })
    },
    async listImportBatches(collection: AdminContentCollection | 'sites') {
      return (await db.query('SELECT id, collection, total_rows, imported_rows, rejected_rows, row_results, created_at FROM content_import_batches WHERE collection = $1 ORDER BY created_at DESC, id DESC LIMIT 20', [collection])).rows
    },
    async importAdminContent(collection: AdminContentCollection | 'sites', rows: Array<{ rowNumber: number; data: Record<string, unknown> }>, adminId: string, totalRows = rows.length, invalidRows = 0, invalidResults: Array<{ rowNumber: number; status: 'rejected'; errors: string[] }> = []) {
      if (!Number.isInteger(totalRows) || totalRows < 1 || rows.length + invalidRows !== totalRows) throw new Error('INVALID_IMPORT_SIZE')
      return db.transaction(async tx => {
        await tx.query("SELECT pg_advisory_xact_lock(hashtext('navhub_content_import'))")
        const results: Array<{ rowNumber: number; status: 'imported' | 'rejected'; id?: string; errors?: string[] }> = []
        const seenSlugs = new Set<string>()
        const seenUrls = new Set<string>()
        for (const [index, row] of rows.entries()) {
          const slug = typeof row.data.slug === 'string' ? row.data.slug : undefined
          const targetUrl = typeof row.data.targetUrl === 'string' ? row.data.targetUrl : undefined
          const contentTable = collection === 'sites' ? 'sites' : collection === 'announcements' ? 'announcements' : publicCollections[collection].table
          const duplicateSlug = slug && collection !== 'announcements' && (await tx.query(`SELECT 1 FROM ${contentTable} WHERE slug = $1 LIMIT 1`, [slug])).rows.length > 0
          const duplicateUrl = targetUrl && (await tx.query('SELECT 1 FROM sites WHERE target_url = $1 UNION ALL SELECT 1 FROM resources WHERE target_url = $1 UNION ALL SELECT 1 FROM announcements WHERE target_url = $1 LIMIT 1', [targetUrl])).rows.length > 0
          const duplicateExisting = duplicateSlug || duplicateUrl
          if (duplicateExisting || (slug && seenSlugs.has(slug)) || (targetUrl && seenUrls.has(targetUrl))) {
            results.push({ rowNumber: row.rowNumber, status: 'rejected', errors: [slug && (duplicateExisting || seenSlugs.has(slug)) ? 'Slug 已存在或本次导入中重复' : '目标 URL 已存在或本次导入中重复'] })
            continue
          }
          const savepoint = `import_row_${index}`
          await tx.query(`SAVEPOINT ${savepoint}`)
          try {
            let id: string
            if (collection === 'sites') {
              const input = siteSchema.parse({ ...row.data, status: 'draft' })
              const inserted = await tx.query<{ id: string }>('INSERT INTO sites (title, slug, description, target_url, icon_url, status, sort_order) VALUES ($1, $2, $3, $4, $5, \'draft\', $6) RETURNING id', [input.title, input.slug, input.description, input.targetUrl, input.iconUrl, input.sortOrder])
              id = inserted.rows[0]!.id
              if (input.categoryIds.length) await tx.query('INSERT INTO site_categories (site_id, category_id) SELECT $1, unnest($2::uuid[])', [id, input.categoryIds])
              if (input.tagIds.length) await tx.query('INSERT INTO site_tags (site_id, tag_id) SELECT $1, unnest($2::uuid[])', [id, input.tagIds])
            } else {
              const { values, tagIds } = contentValues(collection, { ...row.data, status: 'draft' })
              const columns: string[] = values.map(item => item.column)
              const placeholders = values.map((_, index) => `$${index + 1}`)
              if (collection !== 'announcements') {
                columns.push('published_at')
                placeholders.push('NULL')
              }
              const inserted = await tx.query(`INSERT INTO ${publicCollections[collection].table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`, values.map(item => item.value))
              id = String(inserted.rows[0]!.id)
              if (tagIds.length) await tx.query(`INSERT INTO ${publicCollections[collection].tagTable} (${publicCollections[collection].contentId}, tag_id) SELECT $1, unnest($2::uuid[])`, [id, tagIds])
              const categoryIds = (row.data.categoryIds as string[] | undefined) ?? []
              if (collection !== 'announcements' && categoryIds.length) await tx.query(`INSERT INTO ${publicCollections[collection].categoryTable} (${publicCollections[collection].categoryId}, category_id) SELECT $1, unnest($2::uuid[])`, [id, categoryIds])
            }
            await tx.query('INSERT INTO admin_audit_logs (admin_id, action, resource, resource_id) VALUES ($1, $2, $3, $4)', [adminId, 'import_row', collection, id])
            await tx.query(`RELEASE SAVEPOINT ${savepoint}`)
            if (slug) seenSlugs.add(slug)
            if (targetUrl) seenUrls.add(targetUrl)
            results.push({ rowNumber: row.rowNumber, status: 'imported', id })
          } catch (error) {
            await tx.query(`ROLLBACK TO SAVEPOINT ${savepoint}`)
            await tx.query(`RELEASE SAVEPOINT ${savepoint}`)
            if (error instanceof z.ZodError) results.push({ rowNumber: row.rowNumber, status: 'rejected', errors: error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`) })
            else if (error && typeof error === 'object' && 'code' in error && error.code === '23505') results.push({ rowNumber: row.rowNumber, status: 'rejected', errors: ['数据库中已存在相同 slug 或唯一值'] })
            else if (error && typeof error === 'object' && 'code' in error && ['23503', '23514', '22P02'].includes(String(error.code))) results.push({ rowNumber: row.rowNumber, status: 'rejected', errors: ['关联 ID 或内容值无效'] })
            else throw error
          }
        }
        const imported = results.filter(item => item.status === 'imported').length
        const rejected = results.length - imported + invalidRows
        const report = [...results, ...invalidResults].sort((a, b) => a.rowNumber - b.rowNumber)
        const batch = await tx.query<{ id: string }>('INSERT INTO content_import_batches (collection, admin_id, total_rows, imported_rows, rejected_rows, row_results) VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING id', [collection, adminId, totalRows, imported, rejected, JSON.stringify(report)])
        await tx.query('INSERT INTO admin_audit_logs (admin_id, action, resource, resource_id) VALUES ($1, $2, $3, $4)', [adminId, 'import', collection, String(batch.rows[0]!.id)])
        return { batchId: String(batch.rows[0]!.id), total: totalRows, imported, rejected, rows: results }
      })
    },
    async getAdminContent(collection: AdminContentCollection, id: string) {
      const { table, tagTable, contentId } = publicCollections[collection]
      const categoryFields = collection === 'announcements' ? 'ARRAY[]::uuid[]' : `COALESCE(ARRAY(SELECT category_id FROM ${publicCollections[collection].categoryTable} WHERE ${publicCollections[collection].categoryId} = item.id), ARRAY[]::uuid[])`
      const result = await db.query(`SELECT item.*, COALESCE(ARRAY(SELECT tag_id FROM ${tagTable} WHERE ${contentId} = item.id), ARRAY[]::uuid[]) AS tag_ids, ${categoryFields} AS category_ids FROM ${table} item WHERE item.id = $1`, [contentIdSchema.parse(id)])
      return result.rows[0]
    },
    async createAdminContent(collection: AdminContentCollection, raw: unknown) {
      const { values, tagIds } = contentValues(collection, raw)
      const input = adminContentSchemas[collection].parse(raw) as Record<string, unknown>
      const categoryIds = (input.categoryIds ?? []) as string[]
      return db.transaction(async tx => {
        const columns: string[] = values.map(item => item.column)
        const placeholders = values.map((_, index) => `$${index + 1}`)
        if (collection !== 'announcements') {
          columns.push('published_at')
          const statusIndex = values.findIndex(item => item.column === 'status') + 1
          placeholders.push(`CASE WHEN $${statusIndex} = 'published' THEN now() ELSE NULL END`)
        }
        const result = await tx.query(`INSERT INTO ${publicCollections[collection].table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`, values.map(item => item.value))
        const content = result.rows[0]
        if (tagIds.length) await tx.query(`INSERT INTO ${publicCollections[collection].tagTable} (${publicCollections[collection].contentId}, tag_id) SELECT $1, unnest($2::uuid[])`, [content!.id, tagIds])
        if (collection !== 'announcements' && categoryIds.length) await tx.query(`INSERT INTO ${publicCollections[collection].categoryTable} (${publicCollections[collection].categoryId}, category_id) SELECT $1, unnest($2::uuid[])`, [content!.id, categoryIds])
        return { ...content, tag_ids: tagIds, category_ids: categoryIds }
      })
    },
    async updateAdminContent(collection: AdminContentCollection, id: string, raw: unknown) {
      const { values, tagIds } = contentValues(collection, raw)
      const input = adminContentSchemas[collection].parse(raw) as Record<string, unknown>
      const categoryIds = (input.categoryIds ?? []) as string[]
      const contentId = contentIdSchema.parse(id)
      return db.transaction(async tx => {
        const setters = values.map((item, index) => `${item.column} = $${index + 2}`)
        if (collection !== 'announcements') {
          const statusIndex = values.findIndex(item => item.column === 'status') + 2
          setters.push(`published_at = CASE WHEN $${statusIndex} = 'published' THEN COALESCE(published_at, now()) ELSE NULL END`)
        }
        const result = await tx.query(`UPDATE ${publicCollections[collection].table} SET ${setters.join(', ')}, updated_at = now() WHERE id = $1 RETURNING *`, [contentId, ...values.map(item => item.value)])
        if (!result.rows[0]) return undefined
        await tx.query(`DELETE FROM ${publicCollections[collection].tagTable} WHERE ${publicCollections[collection].contentId} = $1`, [contentId])
        if (tagIds.length) await tx.query(`INSERT INTO ${publicCollections[collection].tagTable} (${publicCollections[collection].contentId}, tag_id) SELECT $1, unnest($2::uuid[])`, [contentId, tagIds])
        if (collection !== 'announcements') {
          await tx.query(`DELETE FROM ${publicCollections[collection].categoryTable} WHERE ${publicCollections[collection].categoryId} = $1`, [contentId])
          if (categoryIds.length) await tx.query(`INSERT INTO ${publicCollections[collection].categoryTable} (${publicCollections[collection].categoryId}, category_id) SELECT $1, unnest($2::uuid[])`, [contentId, categoryIds])
        }
        return { ...result.rows[0], tag_ids: tagIds, category_ids: categoryIds }
      })
    },
    async bulkUpdateAdminContent(collection: AdminContentCollection, ids: string[], status: 'draft' | 'published' | 'offline', adminId: string) {
      if (!ids.length || ids.length > 100) throw new Error('INVALID_BULK_SIZE')
      const contentIds = [...new Set(ids.map(id => contentIdSchema.parse(id)))]
      return db.transaction(async tx => {
        const table = publicCollections[collection].table
        const publishedSetter = collection === 'announcements' ? '' : ", published_at = CASE WHEN $2 = 'published' THEN COALESCE(published_at, now()) ELSE NULL END"
        const result = await tx.query(`UPDATE ${table} SET status = $2${publishedSetter}, updated_at = now() WHERE id = ANY($1::uuid[]) RETURNING id`, [contentIds, status])
        const updatedIds = result.rows.map(row => String(row.id))
        for (const id of updatedIds) await tx.query('INSERT INTO admin_audit_logs (admin_id, action, resource, resource_id) VALUES ($1, $2, $3, $4)', [adminId, `bulk_status_${status}`, collection, id])
        return updatedIds
      })
    },
    async bulkUpdateSites(ids: string[], status: 'draft' | 'published' | 'offline', adminId: string) {
      if (!ids.length || ids.length > 100) throw new Error('INVALID_BULK_SIZE')
      const contentIds = [...new Set(ids.map(id => contentIdSchema.parse(id)))]
      return db.transaction(async tx => {
        const result = await tx.query('UPDATE sites SET status = $2, published_at = CASE WHEN $2 = \'published\' THEN COALESCE(published_at, now()) ELSE NULL END, updated_at = now() WHERE id = ANY($1::uuid[]) RETURNING id', [contentIds, status])
        const updatedIds = result.rows.map(row => String(row.id))
        for (const id of updatedIds) await tx.query('INSERT INTO admin_audit_logs (admin_id, action, resource, resource_id) VALUES ($1, $2, $3, $4)', [adminId, `bulk_status_${status}`, 'site', id])
        return updatedIds
      })
    },
    async deleteAdminContent(collection: AdminContentCollection, id: string) {
      const result = await db.query(`DELETE FROM ${publicCollections[collection].table} WHERE id = $1 RETURNING id`, [contentIdSchema.parse(id)])
      return result.rows[0]
    },
    async search(query: string, options: { type?: unknown; page?: unknown; pageSize?: unknown; tag?: unknown; category?: unknown; sort?: unknown } = {}) {
      const input = publicSearchSchema.parse({ q: query, ...options })
      if (input.q.length < 2) return { query: input.q, results: [], total: 0, page: input.page, pageSize: input.pageSize }
      const like = `%${input.q.replace(/[\\%_]/g, '\\$&')}%`
      const source = `
        SELECT id, title, slug, description, target_url, icon_url, created_at, published_at, 'site' AS type FROM sites WHERE status = 'published' AND (title ILIKE $1 OR description ILIKE $1)
        UNION ALL SELECT id, title, slug, description, target_url, cover_url AS icon_url, created_at, published_at, 'resource' AS type FROM resources WHERE status = 'published' AND (title ILIKE $1 OR description ILIKE $1)
        UNION ALL SELECT id, title, slug, description, NULL AS target_url, cover_url AS icon_url, created_at, published_at, 'media' AS type FROM media_items WHERE status = 'published' AND (title ILIKE $1 OR description ILIKE $1)
        UNION ALL SELECT id, title, slug, summary AS description, NULL AS target_url, cover_url AS icon_url, created_at, published_at, 'article' AS type FROM articles WHERE status = 'published' AND (title ILIKE $1 OR summary ILIKE $1 OR body ILIKE $1)
        UNION ALL SELECT id, title, id::text AS slug, body AS description, target_url, NULL AS icon_url, created_at, created_at AS published_at, 'announcement' AS type FROM announcements WHERE ${activeAnnouncement} AND (title ILIKE $1 OR body ILIKE $1)`
      const params: unknown[] = [like, input.type, input.tag]
      const categoryFilter = input.category ? `AND EXISTS (
        SELECT 1 FROM (
          SELECT site_id AS content_id, 'site' AS type, category_id FROM site_categories
          UNION ALL SELECT resource_id, 'resource', category_id FROM resource_categories
          UNION ALL SELECT media_id, 'media', category_id FROM media_categories
          UNION ALL SELECT article_id, 'article', category_id FROM article_categories
        ) search_categories JOIN categories ON categories.id = search_categories.category_id
        WHERE search_categories.content_id = matches.id AND search_categories.type = matches.type AND categories.slug = $4
      )` : ''
      const filtered = `FROM (${source}) matches WHERE ($2 = 'all' OR type = $2)
        AND ($3 = '' OR EXISTS (
          SELECT 1 FROM (
            SELECT site_id AS content_id, 'site' AS type, tag_id FROM site_tags
            UNION ALL SELECT resource_id, 'resource', tag_id FROM resource_tags
            UNION ALL SELECT media_id, 'media', tag_id FROM media_tags
            UNION ALL SELECT article_id, 'article', tag_id FROM article_tags
            UNION ALL SELECT announcement_id, 'announcement', tag_id FROM announcement_tags
          ) search_tags JOIN tags ON tags.id = search_tags.tag_id
          WHERE search_tags.content_id = matches.id AND search_tags.type = matches.type AND tags.slug = $3
        )) ${categoryFilter}`
      if (input.category) params.push(input.category)
      const total = await db.query<{ total: number }>(`SELECT count(*)::int AS total ${filtered}`, params)
      const ordering = input.sort === 'latest' ? 'COALESCE(matches.published_at, matches.created_at) DESC, matches.title, matches.id'
        : input.sort === 'popular' ? `(SELECT count(*) FROM content_events event WHERE event.content_id = matches.id AND event.content_type = matches.type AND event.occurred_at >= now() - interval '30 days') DESC, matches.title, matches.id`
          : `CASE WHEN matches.title ILIKE $1 THEN 0 WHEN matches.description ILIKE $1 THEN 1 ELSE 2 END, matches.title, matches.type, matches.id`
      params.push(input.pageSize, (input.page - 1) * input.pageSize)
      const result = await db.query(`SELECT matches.*, CASE WHEN matches.title ILIKE $1 THEN 0 WHEN matches.description ILIKE $1 THEN 1 ELSE 2 END AS relevance ${filtered} ORDER BY ${ordering} LIMIT $${params.length - 1} OFFSET $${params.length}`, params)
      return { query: input.q, results: result.rows, total: total.rows[0]!.total, page: input.page, pageSize: input.pageSize }
    },
    async createComment(rawInput: CommentInput) {
      const input = commentSchema.parse(rawInput)
      const table = commentTargetTables[input.contentType]
      const result = await db.query(`INSERT INTO comments (content_type, content_id, display_name, email, body) SELECT $1, id, $3, NULLIF($4, ''), $5 FROM ${table} WHERE id = $2 AND status = 'published' RETURNING id`, [input.contentType, input.contentId, input.displayName, input.email ?? '', input.body])
      if (!result.rows[0]) throw new Error('COMMENT_TARGET_NOT_FOUND')
      return result.rows[0]
    },
    async createReport(rawInput: ReportInput, clientHash: string) {
      const input = reportSchema.parse(rawInput)
      const table = commentTargetTables[input.contentType]
      const result = await db.query(`INSERT INTO content_reports (content_type, content_id, reason, details, reporter_name, contact_email, client_hash) SELECT $1, id, $3, $4, NULLIF($5, ''), NULLIF($6, ''), $7 FROM ${table} WHERE id = $2 AND status = 'published' RETURNING id`, [input.contentType, input.contentId, input.reason, input.details, input.reporterName ?? '', input.contactEmail ?? '', clientHash])
      if (!result.rows[0]) throw new Error('REPORT_TARGET_NOT_FOUND')
      return result.rows[0]
    },
    async consumePublicLimit(key: string) {
      const result = await db.query<{ attempts: number }>(`INSERT INTO login_limits (key, attempts, expires_at) VALUES ($1, 1, now() + interval '15 minutes') ON CONFLICT (key) DO UPDATE SET attempts = CASE WHEN login_limits.expires_at <= now() THEN 1 ELSE login_limits.attempts + 1 END, expires_at = CASE WHEN login_limits.expires_at <= now() THEN now() + interval '15 minutes' ELSE login_limits.expires_at END RETURNING attempts`, [key])
      return result.rows[0]!.attempts <= 5
    },
    async createSubmission(rawInput: SubmissionInput) {
      const input = submissionSchema.parse(rawInput)
      await db.query('INSERT INTO guest_submissions (content_type, payload, submitter_name, contact_email) VALUES ($1, $2, NULLIF($3, \'\'), NULLIF($4, \'\'))', [input.contentType, JSON.stringify(input.payload), input.submitterName ?? '', input.contactEmail ?? ''])
    },
    async createSite(input: { title: string; slug: string; description: string; body: string; targetUrl: string; backupUrl?: string | null; previewUrl?: string | null; iconUrl: string | null; status: string; sortOrder: number; categoryIds: string[]; tagIds: string[] }) {
      const result = await db.query(`WITH new_site AS (
        INSERT INTO sites (title, slug, description, body, target_url, icon_url, status, sort_order, published_at, backup_url, preview_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CASE WHEN $7 = 'published' THEN now() ELSE NULL END, $11, $12)
        RETURNING id, title, slug, description, body, target_url, backup_url, preview_url, icon_url, status, sort_order, published_at, created_at, updated_at
      ), category_links AS (
        INSERT INTO site_categories (site_id, category_id)
        SELECT new_site.id, category_id FROM new_site CROSS JOIN unnest($9::uuid[]) AS category_id
      ), tag_links AS (
        INSERT INTO site_tags (site_id, tag_id)
        SELECT new_site.id, tag_id FROM new_site CROSS JOIN unnest($10::uuid[]) AS tag_id
      ) SELECT * FROM new_site`, [input.title, input.slug, input.description, input.body ?? '', input.targetUrl, input.iconUrl, input.status, input.sortOrder, input.categoryIds, input.tagIds, input.backupUrl ?? null, input.previewUrl ?? null])
      return result.rows[0]
    },
    async updateSite(id: string, input: { title: string; slug: string; description: string; body: string; targetUrl: string; backupUrl?: string | null; previewUrl?: string | null; iconUrl: string | null; status: string; sortOrder: number; categoryIds: string[]; tagIds: string[] }) {
      return db.transaction(async (tx) => {
        const result = await tx.query(`UPDATE sites SET title = $2, slug = $3, description = $4, body = $5, target_url = $6, icon_url = $7, status = $8, sort_order = $9, backup_url = $10, preview_url = $11, published_at = CASE WHEN $8 = 'published' THEN COALESCE(published_at, now()) ELSE NULL END, updated_at = now() WHERE id = $1 RETURNING id, title, slug, description, body, target_url, backup_url, preview_url, icon_url, status, sort_order, published_at, created_at, updated_at`, [id, input.title, input.slug, input.description, input.body ?? '', input.targetUrl, input.iconUrl, input.status, input.sortOrder, input.backupUrl ?? null, input.previewUrl ?? null])
        if (!result.rows[0]) return undefined
        await tx.query('DELETE FROM site_categories WHERE site_id = $1', [id])
        await tx.query('DELETE FROM site_tags WHERE site_id = $1', [id])
        if (input.categoryIds.length) await tx.query('INSERT INTO site_categories (site_id, category_id) SELECT $1, unnest($2::uuid[])', [id, input.categoryIds])
        if (input.tagIds.length) await tx.query('INSERT INTO site_tags (site_id, tag_id) SELECT $1, unnest($2::uuid[])', [id, input.tagIds])
        return result.rows[0]
      })
    },
    async deleteSite(id: string) {
      const result = await db.query('DELETE FROM sites WHERE id = $1 RETURNING id', [id])
      return result.rows[0]
    },
    async audit(adminId: string, action: string, resource: string, resourceId?: string) {
      await db.query('INSERT INTO admin_audit_logs (admin_id, action, resource, resource_id) VALUES ($1, $2, $3, $4)', [adminId, action, resource, resourceId ?? null])
    },
    async reorderCategories(items: Array<{ id: string; sortOrder: number }>, adminId: string) {
      return db.transaction(async tx => {
        for (const item of items) await tx.query('UPDATE categories SET sort_order = $2, updated_at = now() WHERE id = $1', [contentIdSchema.parse(item.id), item.sortOrder])
        await tx.query('INSERT INTO admin_audit_logs (admin_id, action, resource) VALUES ($1, $2, $3)', [adminId, 'reorder', 'category'])
        return items.length
      })
    },
    async reorderTags(items: Array<{ id: string; sortOrder: number }>, adminId: string) {
      return db.transaction(async tx => {
        for (const item of items) await tx.query('UPDATE tags SET sort_order = $2, updated_at = now() WHERE id = $1', [contentIdSchema.parse(item.id), item.sortOrder])
        await tx.query('INSERT INTO admin_audit_logs (admin_id, action, resource) VALUES ($1, $2, $3)', [adminId, 'reorder', 'tag'])
        return items.length
      })
    },
    async createCategory(input: { name: string; slug: string; description: string; parentId: string | null; sortOrder: number; iconName?: string | null }) {
      const result = await db.query('INSERT INTO categories (name, slug, description, parent_id, sort_order, icon_name) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, slug, description, parent_id, sort_order, icon_name, created_at, updated_at', [input.name, input.slug, input.description, input.parentId, input.sortOrder, input.iconName ?? null])
      return result.rows[0]
    },
    async createTag(input: { name: string; slug: string; description: string; sortOrder?: number; iconName?: string | null }) {
      const result = await db.query('INSERT INTO tags (name, slug, description, sort_order, icon_name) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, slug, description, sort_order, icon_name, created_at, updated_at', [input.name, input.slug, input.description, input.sortOrder ?? 0, input.iconName ?? null])
      return result.rows[0]
    },
    async updateCategory(id: string, input: { name: string; slug: string; description: string; parentId: string | null; sortOrder: number; iconName?: string | null }) {
      const categoryId = contentIdSchema.parse(id)
      if (input.parentId === categoryId) throw new Error('CATEGORY_PARENT_CYCLE')
      if (input.parentId) {
        const parent = await db.query<{ id: string }>('SELECT id FROM categories WHERE id = $1', [contentIdSchema.parse(input.parentId)])
        if (!parent.rows[0]) throw new Error('CATEGORY_PARENT_NOT_FOUND')
        const cycle = await db.query<{ id: string }>(`WITH RECURSIVE descendants AS (SELECT id FROM categories WHERE parent_id = $1 UNION SELECT c.id FROM categories c JOIN descendants d ON c.parent_id = d.id) SELECT id FROM descendants WHERE id = $2 LIMIT 1`, [categoryId, input.parentId])
        if (cycle.rows[0]) throw new Error('CATEGORY_PARENT_CYCLE')
      }
      const result = await db.query('UPDATE categories SET name = $2, slug = $3, description = $4, parent_id = $5, sort_order = $6, icon_name = CASE WHEN $7 THEN $8::text ELSE icon_name END, updated_at = now() WHERE id = $1 RETURNING id, name, slug, description, parent_id, sort_order, icon_name, created_at, updated_at', [categoryId, input.name, input.slug, input.description, input.parentId, input.sortOrder, input.iconName !== undefined, input.iconName ?? null])
      return result.rows[0]
    },
    async deleteCategory(id: string) {
      return db.transaction(async tx => {
        const categoryId = contentIdSchema.parse(id)
        await tx.query('UPDATE categories SET parent_id = NULL, updated_at = now() WHERE parent_id = $1', [categoryId])
        const result = await tx.query('DELETE FROM categories WHERE id = $1 RETURNING id', [categoryId])
        return result.rows[0]
      })
    },
    async updateTag(id: string, input: { name: string; slug: string; description: string; sortOrder?: number; iconName?: string | null }) {
      const result = await db.query('UPDATE tags SET name = $2, slug = $3, description = $4, sort_order = $5, icon_name = CASE WHEN $6 THEN $7::text ELSE icon_name END, updated_at = now() WHERE id = $1 RETURNING id, name, slug, description, sort_order, icon_name, created_at, updated_at', [contentIdSchema.parse(id), input.name, input.slug, input.description, input.sortOrder ?? 0, input.iconName !== undefined, input.iconName ?? null])
      return result.rows[0]
    },
    async deleteTag(id: string) {
      const result = await db.query('DELETE FROM tags WHERE id = $1 RETURNING id', [contentIdSchema.parse(id)])
      return result.rows[0]
    },
    async listCategories() {
      const result = await db.query('SELECT id, name, slug, description, parent_id, sort_order, icon_name, created_at, updated_at FROM categories ORDER BY sort_order, name')
      return result.rows
    },
    async listTags() {
      const result = await db.query('SELECT id, name, slug, description, sort_order, icon_name, created_at, updated_at FROM tags ORDER BY sort_order, name')
      return result.rows
    },
    async listSubmissions(options: { status?: string; contentType?: string; from?: string; to?: string; page?: number; pageSize?: number } = {}) {
      const page = options.page ?? 1
      const pageSize = options.pageSize ?? 20
      const clauses: string[] = []
      const parameters: unknown[] = []
      if (options.status) { parameters.push(options.status); clauses.push(`status = $${parameters.length}`) }
      if (options.contentType) { parameters.push(options.contentType); clauses.push(`content_type = $${parameters.length}`) }
      if (options.from) { parameters.push(options.from); clauses.push(`created_at >= $${parameters.length}`) }
      if (options.to) { parameters.push(options.to); clauses.push(`created_at < ($${parameters.length}::date + interval '1 day')`) }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
      const count = await db.query<{ total: number }>(`SELECT count(*)::int AS total FROM guest_submissions ${where}`, parameters)
      parameters.push(pageSize, (page - 1) * pageSize)
      const result = await db.query(`SELECT id, content_type, payload, submitter_name, contact_email, status, review_note, created_at, reviewed_at, published_content_id, CASE WHEN content_type IN ('site', 'resource') THEN EXISTS (SELECT 1 FROM sites s WHERE s.target_url = payload->>'targetUrl') OR EXISTS (SELECT 1 FROM resources r WHERE r.target_url = payload->>'targetUrl') ELSE false END AS duplicate_url, CASE WHEN content_type IN ('site', 'resource', 'media', 'article') THEN EXISTS (
        SELECT 1 FROM (
          SELECT title FROM sites WHERE status = 'published' UNION ALL SELECT title FROM resources WHERE status = 'published' UNION ALL SELECT title FROM media_items WHERE status = 'published' UNION ALL SELECT title FROM articles WHERE status = 'published'
        ) published_titles WHERE lower(regexp_replace(published_titles.title, '[^[:alnum:][:space:]]', '', 'g')) = lower(regexp_replace(payload->>'title', '[^[:alnum:][:space:]]', '', 'g')) AND lower(published_titles.title) <> lower(payload->>'title')
      ) ELSE false END AS similar_title FROM guest_submissions ${where} ORDER BY created_at DESC, id LIMIT $${parameters.length - 1} OFFSET $${parameters.length}`, parameters)
      const total = count.rows[0]?.total ?? 0
      return { items: result.rows, total, page, pageSize, pageCount: Math.ceil(total / pageSize) }
    },
    async reviewSubmission(id: string, status: 'approved' | 'rejected' | 'spam', note: string | null, adminId: string, revisedPayload?: Record<string, unknown>, categoryIds: string[] = [], tagIds: string[] = []) {
      return db.transaction(async (tx) => {
        const submission = await tx.query<{ id: string; content_type: string; payload: Record<string, unknown>; status: string }>('SELECT id, content_type, payload, status FROM guest_submissions WHERE id = $1 AND status = \'pending\' FOR UPDATE', [id])
        if (!submission.rows[0]) return undefined
        let publishedContentId: string | null = null
        const contentType = submission.rows[0].content_type
        const payload = revisedPayload ?? submission.rows[0].payload
        if (status === 'approved' && contentType === 'site') {
          const parsed = submissionSchema.parse({ contentType, payload }).payload as Extract<SubmissionInput, { contentType: 'site' }>['payload']
          const site = await tx.query<{ id: string }>(`INSERT INTO sites (title, slug, description, target_url, icon_url, status, published_at) VALUES ($1, $2, $3, $4, $5, 'published', now()) RETURNING id`, [parsed.title, parsed.slug ?? `submitted-${id.slice(0, 8)}`, parsed.description, parsed.targetUrl, parsed.iconUrl ?? null])
          publishedContentId = site.rows[0]!.id
          if (categoryIds.length) await tx.query('INSERT INTO site_categories (site_id, category_id) SELECT $1, unnest($2::uuid[])', [publishedContentId, categoryIds])
          if (tagIds.length) await tx.query('INSERT INTO site_tags (site_id, tag_id) SELECT $1, unnest($2::uuid[])', [publishedContentId, tagIds])
        } else if (status === 'approved' && contentType === 'resource') {
          const parsed = submissionSchema.parse({ contentType, payload }).payload as Extract<SubmissionInput, { contentType: 'resource' }>['payload']
          const created = await tx.query<{ id: string }>(`INSERT INTO resources (title, slug, description, resource_type, cover_url, target_url, status, published_at) VALUES ($1, $2, $3, $4, $5, $6, 'published', now()) RETURNING id`, [parsed.title, parsed.slug ?? `submitted-${id.slice(0, 8)}`, parsed.description, parsed.resourceType, parsed.coverUrl ?? null, parsed.targetUrl])
          publishedContentId = created.rows[0]!.id
          if (categoryIds.length) await tx.query('INSERT INTO resource_categories (resource_id, category_id) SELECT $1, unnest($2::uuid[])', [publishedContentId, categoryIds])
          if (tagIds.length) await tx.query('INSERT INTO resource_tags (resource_id, tag_id) SELECT $1, unnest($2::uuid[])', [publishedContentId, tagIds])
        } else if (status === 'approved' && contentType === 'media') {
          const parsed = submissionSchema.parse({ contentType, payload }).payload as Extract<SubmissionInput, { contentType: 'media' }>['payload']
          const created = await tx.query<{ id: string }>(`INSERT INTO media_items (title, slug, description, media_type, cover_url, rating, status, published_at) VALUES ($1, $2, $3, $4, $5, $6, 'published', now()) RETURNING id`, [parsed.title, parsed.slug ?? `submitted-${id.slice(0, 8)}`, parsed.description, parsed.mediaType, parsed.coverUrl ?? null, parsed.rating ?? null])
          publishedContentId = created.rows[0]!.id
          if (categoryIds.length) await tx.query('INSERT INTO media_categories (media_id, category_id) SELECT $1, unnest($2::uuid[])', [publishedContentId, categoryIds])
          if (tagIds.length) await tx.query('INSERT INTO media_tags (media_id, tag_id) SELECT $1, unnest($2::uuid[])', [publishedContentId, tagIds])
        } else if (status === 'approved' && contentType === 'article') {
          const parsed = submissionSchema.parse({ contentType, payload }).payload as Extract<SubmissionInput, { contentType: 'article' }>['payload']
          const created = await tx.query<{ id: string }>(`INSERT INTO articles (title, slug, summary, body, cover_url, status, published_at) VALUES ($1, $2, $3, $4, $5, 'published', now()) RETURNING id`, [parsed.title, parsed.slug ?? `submitted-${id.slice(0, 8)}`, parsed.summary, parsed.body, parsed.coverUrl ?? null])
          publishedContentId = created.rows[0]!.id
          if (categoryIds.length) await tx.query('INSERT INTO article_categories (article_id, category_id) SELECT $1, unnest($2::uuid[])', [publishedContentId, categoryIds])
          if (tagIds.length) await tx.query('INSERT INTO article_tags (article_id, tag_id) SELECT $1, unnest($2::uuid[])', [publishedContentId, tagIds])
        }
        const result = await tx.query('UPDATE guest_submissions SET payload = $5::jsonb, status = $2, review_note = $3, published_content_id = $4, reviewed_at = now() WHERE id = $1 AND status = \'pending\' RETURNING id, status, published_content_id', [id, status, note, publishedContentId, JSON.stringify(payload)])
        if (!result.rows[0]) return undefined
        await tx.query('INSERT INTO moderation_reviews (item_type, item_id, previous_status, status, note, admin_id) VALUES (\'submission\', $1, $2, $3, $4, $5)', [id, submission.rows[0].status, status, note, adminId])
        await tx.query('INSERT INTO admin_audit_logs (admin_id, action, resource, resource_id) VALUES ($1, $2, $3, $4)', [adminId, `submission_${status}`, 'guest_submission', id])
        return result.rows[0]
      })
    },
    async takeSubmissionOffline(id: string, note: string | null, adminId: string) {
      return db.transaction(async tx => {
        const submission = await tx.query<{ id: string; content_type: string; published_content_id: string | null; status: string }>('SELECT id, content_type, published_content_id, status FROM guest_submissions WHERE id = $1 FOR UPDATE', [id])
        const row = submission.rows[0]
        if (!row?.published_content_id || row.status !== 'approved') return undefined
        const table = ({ site: 'sites', resource: 'resources', media: 'media_items', article: 'articles' } as Record<string, string>)[row.content_type]
        if (!table) return undefined
        const updated = await tx.query(`UPDATE ${table} SET status = 'offline', published_at = NULL, updated_at = now() WHERE id = $1 AND status = 'published' RETURNING id`, [row.published_content_id])
        if (!updated.rows[0]) return undefined
        await tx.query('INSERT INTO moderation_reviews (item_type, item_id, previous_status, status, note, admin_id) VALUES (\'submission\', $1, $2, \'offline\', $3, $4)', [id, row.status, note, adminId])
        await tx.query('INSERT INTO admin_audit_logs (admin_id, action, resource, resource_id) VALUES ($1, $2, $3, $4)', [adminId, 'submission_offline', 'guest_submission', id])
        return { id, status: 'offline', published_content_id: row.published_content_id }
      })
    },
    async listComments(options: { status?: string; from?: string; to?: string; page?: number; pageSize?: number } = {}) {
      const page = options.page ?? 1
      const pageSize = options.pageSize ?? 20
      const clauses: string[] = []
      const parameters: unknown[] = []
      if (options.status) { parameters.push(options.status); clauses.push(`status = $${parameters.length}`) }
      if (options.from) { parameters.push(options.from); clauses.push(`created_at >= $${parameters.length}`) }
      if (options.to) { parameters.push(options.to); clauses.push(`created_at < ($${parameters.length}::date + interval '1 day')`) }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
      const count = await db.query<{ total: number }>(`SELECT count(*)::int AS total FROM comments ${where}`, parameters)
      parameters.push(pageSize, (page - 1) * pageSize)
      const result = await db.query(`SELECT id, content_type, content_id, display_name, body, status, created_at, reviewed_at FROM comments ${where} ORDER BY created_at DESC, id LIMIT $${parameters.length - 1} OFFSET $${parameters.length}`, parameters)
      const total = count.rows[0]?.total ?? 0
      return { items: result.rows, total, page, pageSize, pageCount: Math.ceil(total / pageSize) }
    },
    async listReports(options: { status?: string; page?: number; pageSize?: number } = {}) {
      const page = options.page ?? 1
      const pageSize = options.pageSize ?? 20
      const parameters: unknown[] = []
      const where = options.status ? `WHERE r.status = $1` : ''
      if (options.status) parameters.push(options.status)
      const count = await db.query<{ total: number }>(`SELECT count(*)::int AS total FROM content_reports r ${where}`, parameters)
      parameters.push(pageSize, (page - 1) * pageSize)
      const result = await db.query(`SELECT r.id, r.content_type, r.content_id, r.reason, r.details, r.status, r.review_note, r.reviewed_at, r.created_at, COALESCE(s.title, re.title, m.title, a.title) AS content_title FROM content_reports r LEFT JOIN sites s ON r.content_type = 'site' AND s.id = r.content_id LEFT JOIN resources re ON r.content_type = 'resource' AND re.id = r.content_id LEFT JOIN media_items m ON r.content_type = 'media' AND m.id = r.content_id LEFT JOIN articles a ON r.content_type = 'article' AND a.id = r.content_id ${where} ORDER BY r.created_at DESC, r.id LIMIT $${parameters.length - 1} OFFSET $${parameters.length}`, parameters)
      const total = count.rows[0]?.total ?? 0
      return { items: result.rows, total, page, pageSize, pageCount: Math.ceil(total / pageSize) }
    },
    async reviewReport(id: string, status: 'reviewed' | 'dismissed', adminId: string, note: string | null = null) {
      return db.transaction(async tx => {
        const result = await tx.query("UPDATE content_reports SET status = $2, review_note = $3, reviewed_at = now() WHERE id = $1 AND status = 'pending' RETURNING id, status", [contentIdSchema.parse(id), status, note])
        if (!result.rows[0]) return undefined
        await tx.query('INSERT INTO admin_audit_logs (admin_id, action, resource, resource_id) VALUES ($1, $2, $3, $4)', [adminId, `report_${status}`, 'content_report', id])
        return result.rows[0]
      })
    },
    async getModerationHistory(type: 'submission' | 'comment', id: string) {
      const result = await db.query('SELECT previous_status, status, note, admin_id, created_at FROM moderation_reviews WHERE item_type = $1 AND item_id = $2 ORDER BY created_at DESC', [type, id])
      return result.rows
    },
    async getSubmission(id: string) {
      const result = await db.query('SELECT id, content_type, payload, submitter_name, contact_email, status, review_note, created_at, reviewed_at, published_content_id FROM guest_submissions WHERE id = $1', [contentIdSchema.parse(id)])
      return result.rows[0]
    },
    async getComment(id: string) {
      const result = await db.query('SELECT id, content_type, content_id, display_name, email, body, status, created_at, reviewed_at FROM comments WHERE id = $1', [contentIdSchema.parse(id)])
      return result.rows[0]
    },
    async listApprovedComments(contentType: string, contentId: string) {
      const result = await db.query('SELECT id, display_name, body, created_at FROM comments WHERE content_type = $1 AND content_id = $2 AND status = \'approved\' ORDER BY created_at ASC LIMIT 100', [contentType, contentId])
      return result.rows
    },
    async moderationCounts() {
      const result = await db.query<{ pending_submissions: number; pending_comments: number; published_sites: number }>(`SELECT (SELECT count(*)::int FROM guest_submissions WHERE status = 'pending') AS pending_submissions, (SELECT count(*)::int FROM comments WHERE status = 'pending') AS pending_comments, (SELECT count(*)::int FROM sites WHERE status = 'published') AS published_sites`)
      return result.rows[0]
    },
    async getDashboardMetrics() {
      const [counts, events, failedLinks, popularSites, popularSearches, completeness] = await Promise.all([
        this.moderationCounts(),
        db.query<{ event_type: PublicEventType; count: number }>(`SELECT event_type, count(*)::int AS count FROM content_events WHERE occurred_at >= now() - interval '7 days' GROUP BY event_type`),
        db.query<{ count: number }>(`SELECT count(*)::int AS count
          FROM link_health_checks h
          WHERE h.ignored_at IS NULL
            AND h.result_category IN ('http_error', 'timeout', 'dns_error', 'unsafe_target', 'redirect_error', 'network_error')
            AND (EXISTS (SELECT 1 FROM sites s WHERE s.id = h.content_id AND h.content_type = 'site' AND s.status = 'published')
              OR EXISTS (SELECT 1 FROM resources r WHERE r.id = h.content_id AND h.content_type = 'resource' AND r.status = 'published'))`),
        db.query<{ id: string; title: string; count: number }>(`SELECT s.id, s.title, count(e.*)::int AS count
          FROM sites s JOIN content_events e ON e.content_type = 'site' AND e.content_id = s.id
          WHERE s.status = 'published' AND e.occurred_at >= now() - interval '7 days'
          GROUP BY s.id, s.title ORDER BY count DESC, s.title, s.id LIMIT 5`),
        db.query<{ term: string; searches: number }>(`SELECT term, searches FROM search_discovery_terms
          WHERE updated_at >= now() - interval '30 days' ORDER BY searches DESC, term LIMIT 5`),
        db.query<{ content_type: string; count: number }>(`WITH issues AS (
            SELECT 'site' AS content_type, s.id
            FROM sites s
            WHERE s.status = 'published' AND (s.description = '' OR s.icon_url IS NULL OR NOT EXISTS (SELECT 1 FROM site_categories sc WHERE sc.site_id = s.id))
            UNION ALL
            SELECT 'resource', r.id
            FROM resources r
            WHERE r.status = 'published' AND (r.description = '' OR r.cover_url IS NULL OR NOT EXISTS (SELECT 1 FROM resource_categories rc WHERE rc.resource_id = r.id))
            UNION ALL
            SELECT 'media', m.id
            FROM media_items m
            WHERE m.status = 'published' AND (m.description = '' OR m.cover_url IS NULL)
            UNION ALL
            SELECT 'article', a.id
            FROM articles a
            WHERE a.status = 'published' AND (a.summary = '' OR a.cover_url IS NULL)
          ) SELECT content_type, count(*)::int AS count FROM issues GROUP BY content_type ORDER BY content_type`)
      ])
      const totals = { views: 0, clicks: 0 }
      for (const event of events.rows) {
        if (event.event_type === 'view') totals.views = event.count
        if (event.event_type === 'outbound_click') totals.clicks = event.count
      }
      return {
        counts: { ...counts, failed_links: failedLinks.rows[0]?.count ?? 0, completeness_issues: completeness.rows.reduce((sum, item) => sum + item.count, 0) },
        events: totals,
        popular_sites: popularSites.rows,
        popular_searches: popularSearches.rows,
        completeness: completeness.rows
      }
    },
    async getSearchAnalytics() {
      const [summary, zeroResults, terms] = await Promise.all([
        db.query<{ searches: number; clicks: number; zero_results: number }>(`SELECT COALESCE(sum(searches), 0)::int AS searches, COALESCE(sum(clicks), 0)::int AS clicks, COALESCE(sum(zero_results), 0)::int AS zero_results FROM search_analytics WHERE updated_at >= now() - interval '30 days'`),
        db.query<{ term: string; content_type: string; searches: number; zero_results: number }>(`SELECT term, content_type, searches, zero_results FROM search_analytics WHERE updated_at >= now() - interval '30 days' AND zero_results > 0 ORDER BY zero_results DESC, searches DESC, term LIMIT 50`),
        db.query<{ term: string; content_type: string; searches: number; clicks: number }>(`SELECT term, content_type, searches, clicks FROM search_analytics WHERE updated_at >= now() - interval '30 days' ORDER BY searches DESC, term LIMIT 50`)
      ])
      const counts = summary.rows[0] ?? { searches: 0, clicks: 0, zero_results: 0 }
      return { days: 30, ...counts, conversion_rate: counts.searches ? counts.clicks / counts.searches : 0, zero_result_terms: zeroResults.rows, top_terms: terms.rows }
    },
    async getSiteQualitySummary() {
      const result = await db.query<{ issue: string; count: number }>(`WITH published AS (
        SELECT s.id, s.description, s.target_url, s.status,
          (SELECT count(*) FROM site_categories sc WHERE sc.site_id = s.id) AS category_count,
          regexp_replace(regexp_replace(lower(s.target_url), '^https?://(www\\.)?', ''), '/$', '') AS normalized_url
        FROM sites s WHERE s.status = 'published'
      ), duplicate_urls AS (
        SELECT normalized_url FROM published GROUP BY normalized_url HAVING count(*) > 1
      )
      SELECT issue, count(*)::int AS count FROM (
        SELECT 'missing_description' AS issue, id FROM published WHERE btrim(description) = ''
        UNION ALL SELECT 'missing_category', id FROM published WHERE category_count = 0
        UNION ALL SELECT 'broken_url', h.content_id AS id FROM link_health_checks h JOIN published p ON p.id = h.content_id WHERE h.content_type = 'site' AND h.ignored_at IS NULL AND h.result_category IN ('http_error', 'timeout', 'dns_error', 'unsafe_target', 'redirect_error', 'network_error')
        UNION ALL SELECT 'duplicate_site', p.id FROM published p JOIN duplicate_urls d ON d.normalized_url = p.normalized_url
      ) issues GROUP BY issue`)
      return Object.fromEntries(result.rows.map(row => [row.issue, row.count])) as Record<string, number>
    },
    async reviewComment(id: string, status: 'approved' | 'rejected' | 'spam', adminId: string, note: string | null = null) {
      return db.transaction(async tx => {
        const current = await tx.query<{ status: string }>('SELECT status FROM comments WHERE id = $1 AND status = \'pending\' FOR UPDATE', [id])
        if (!current.rows[0]) return undefined
        const result = await tx.query('UPDATE comments SET status = $2, reviewed_at = now() WHERE id = $1 AND status = \'pending\' RETURNING id, status', [id, status])
        if (!result.rows[0]) return undefined
        await tx.query('INSERT INTO moderation_reviews (item_type, item_id, previous_status, status, note, admin_id) VALUES (\'comment\', $1, $2, $3, $4, $5)', [id, current.rows[0].status, status, note, adminId])
        await tx.query('INSERT INTO admin_audit_logs (admin_id, action, resource, resource_id) VALUES ($1, $2, $3, $4)', [adminId, `comment_${status}`, 'comment', id])
        return result.rows[0]
      })
    }
  }
}
