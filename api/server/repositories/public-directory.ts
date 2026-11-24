import { parsePublicList } from '../../../shared/schemas/public-list'
import { contentIdSchema } from '../../../shared/schemas/admin-content'
import type { PublicContent } from '../../../shared/types/public-content'
import type { ContentDatabase } from './content'

const sources = {
  sites: { table: 'sites', type: 'site', summary: 'description', tags: 'site_tags', foreignKey: 'site_id', subtype: null, categoryTable: 'site_categories', categoryForeignKey: 'site_id' },
  resources: { table: 'resources', type: 'resource', summary: 'description', tags: 'resource_tags', foreignKey: 'resource_id', subtype: 'resource_type', categoryTable: 'resource_categories', categoryForeignKey: 'resource_id' },
  media: { table: 'media_items', type: 'media', summary: 'description', tags: 'media_tags', foreignKey: 'media_id', subtype: 'media_type', categoryTable: 'media_categories', categoryForeignKey: 'media_id' },
  articles: { table: 'articles', type: 'article', summary: 'summary', tags: 'article_tags', foreignKey: 'article_id', subtype: null, categoryTable: 'article_categories', categoryForeignKey: 'article_id' }
} as const

type DirectorySite = PublicContent & { slug: string; description: string; target_url: string; icon_url: string | null; category_ids: string[] }
type DirectoryCategory = { id: string; name: string; slug: string; parent_id: string | null; total: number; sites: DirectorySite[] }
const categoryTree = `WITH RECURSIVE tree AS (
  SELECT id AS root_id, id FROM categories
  UNION SELECT tree.root_id, cat.id FROM categories cat JOIN tree ON cat.parent_id = tree.id
)`

export function createPublicDirectoryRepository(db: ContentDatabase) {
  return {
    async listCategorySites(categoryId: string) {
      const id = categoryId
      const category = (await db.query<{ id: string; name: string }>('SELECT id, name FROM categories WHERE id = $1', [id])).rows[0]
      if (!category) return undefined
      const items = (await db.query(`SELECT s.id, s.title, s.slug, s.target_url, COALESCE(settings.pinned, false) AS pinned, COALESCE(settings.sort_order, ROW_NUMBER() OVER (ORDER BY s.sort_order, s.created_at DESC, s.id) - 1)::int AS sort_order FROM sites s JOIN site_categories sc ON sc.site_id = s.id AND sc.category_id = $1 LEFT JOIN site_category_settings settings ON settings.site_id = s.id AND settings.category_id = $1 WHERE s.status = 'published' ORDER BY COALESCE(settings.pinned, false) DESC, COALESCE(settings.sort_order, 999999), s.sort_order, s.created_at DESC, s.id`, [id])).rows
      return { category, items }
    },
    async reorderCategorySites(categoryId: string, items: Array<{ id: string; pinned: boolean; sortOrder: number }>, adminId: string) {
      return db.transaction(async tx => {
        const category = await tx.query<{ id: string }>('SELECT id FROM categories WHERE id = $1 FOR UPDATE', [categoryId])
        if (!category.rows[0]) return undefined
        const expected = (await tx.query<{ id: string }>("SELECT s.id FROM sites s JOIN site_categories sc ON sc.site_id = s.id AND sc.category_id = $1 WHERE s.status = 'published' ORDER BY s.id", [categoryId])).rows.map(row => String(row.id)).sort()
        let provided: string[]
        try { provided = items.map(item => contentIdSchema.parse(item.id)).sort() }
        catch { throw new Error('INVALID_CATEGORY_SITE_ORDER') }
        if (expected.length !== provided.length || expected.some((value, index) => value !== provided[index])) throw new Error('INVALID_CATEGORY_SITE_ORDER')
        if (items.some(item => !Number.isInteger(item.sortOrder) || item.sortOrder < 0 || item.sortOrder > 999999) || new Set(items.map(item => item.sortOrder)).size !== items.length) throw new Error('INVALID_CATEGORY_SITE_ORDER')
        for (const item of items) await tx.query('INSERT INTO site_category_settings (site_id, category_id, pinned, sort_order) VALUES ($1, $2, $3, $4) ON CONFLICT (site_id, category_id) DO UPDATE SET pinned = EXCLUDED.pinned, sort_order = EXCLUDED.sort_order, updated_at = now()', [item.id, categoryId, item.pinned, item.sortOrder])
        await tx.query('INSERT INTO admin_audit_logs (admin_id, action, resource, resource_id) VALUES ($1, $2, $3, $4)', [adminId, 'reorder_sites', 'category', categoryId])
        return items.length
      })
    },
    async homepageCategories() {
      const categories = (await db.query<DirectoryCategory & Record<string, unknown>>(`${categoryTree}, ranked AS (
        SELECT tree.root_id, s.id, row_number() OVER (PARTITION BY tree.root_id ORDER BY COALESCE(settings.pinned, false) DESC, COALESCE(settings.sort_order, 999999), s.sort_order, s.created_at DESC, s.id) AS position
        FROM tree JOIN site_categories sc ON sc.category_id = tree.id JOIN sites s ON s.id = sc.site_id AND s.status = 'published'
        LEFT JOIN site_category_settings settings ON settings.site_id = s.id AND settings.category_id = tree.root_id
        GROUP BY tree.root_id, s.id, settings.pinned, settings.sort_order
      ) SELECT cat.id, cat.name, cat.slug, cat.parent_id, count(r.id)::int AS total,
        COALESCE(jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'slug', s.slug, 'description', s.description,
          'target_url', s.target_url, 'icon_url', s.icon_url, 'sort_order', r.position) ORDER BY r.position) FILTER (WHERE r.position <= 12), '[]'::jsonb) AS sites
        FROM categories cat LEFT JOIN ranked r ON r.root_id = cat.id LEFT JOIN sites s ON s.id = r.id
        GROUP BY cat.id ORDER BY cat.sort_order, cat.name, cat.id`)).rows
      const total = (await db.query<{ total: number }>("SELECT count(*)::int AS total FROM sites WHERE status = 'published'")).rows[0]!.total
      return { categories, total }
    },
    async category(slug: string, raw: unknown) {
      const category = (await db.query<{ id: string; name: string; slug: string; description: string; parent_id: string | null; parent_name: string | null; parent_slug: string | null }>('SELECT c.id, c.name, c.slug, c.description, c.parent_id, p.name AS parent_name, p.slug AS parent_slug FROM categories c LEFT JOIN categories p ON p.id = c.parent_id WHERE c.slug = $1', [slug])).rows[0]
      if (!category) return undefined
      const children = (await db.query<{ id: string; name: string; slug: string }>('SELECT id, name, slug FROM categories WHERE parent_id = $1 ORDER BY sort_order, name, id', [category.id])).rows
      return { ...category, children, ...await this.list('sites', raw, category.id) }
    },
    async list(collection: keyof typeof sources, raw: unknown, categoryId?: string) {
      const options = parsePublicList(collection, raw)
      const source = sources[collection]
      const parameters: unknown[] = []
      const filters = ["c.status = 'published'"]
      const filterCategory = options.category ? (await db.query<{ id: string }>('SELECT id FROM categories WHERE slug = $1', [options.category])).rows[0]?.id : undefined
      if (options.q) {
        parameters.push(`%${options.q.replace(/[\\%_]/g, '\\$&')}%`)
        filters.push(`(c.title ILIKE $${parameters.length} OR c.${source.summary} ILIKE $${parameters.length})`)
      }
      if (options.subtype !== 'all' && source.subtype) {
        parameters.push(options.subtype)
        filters.push(`c.${source.subtype} = $${parameters.length}`)
      }
      if (options.tag) {
        parameters.push(options.tag)
        filters.push(`EXISTS (SELECT 1 FROM ${source.tags} link JOIN tags t ON t.id = link.tag_id WHERE link.${source.foreignKey} = c.id AND t.slug = $${parameters.length})`)
      }
      if (categoryId || filterCategory) {
        parameters.push(categoryId ?? filterCategory)
        filters.push(`EXISTS (SELECT 1 FROM ${source.categoryTable} sc JOIN tree ON tree.id = sc.category_id WHERE sc.${source.categoryForeignKey} = c.id AND tree.root_id = $${parameters.length})`)
      }
      const orderCategoryId = categoryId ?? filterCategory
      const categoryParameter = orderCategoryId ? parameters.length : undefined
      const prefix = orderCategoryId ? categoryTree : ''
      const where = `FROM ${source.table} c WHERE ${filters.join(' AND ')}`
      const total = (await db.query<{ total: number }>(`${prefix} SELECT count(*)::int AS total ${where}`, parameters)).rows[0]!.total
      const order = {
        latest: 'COALESCE(c.published_at, c.created_at) DESC', updated: 'c.updated_at DESC', title: 'c.title',
        popular: `(SELECT count(*) FROM content_events e WHERE e.content_id = c.id AND e.content_type = '${source.type}' AND e.occurred_at BETWEEN now() - interval '30 days' AND now()) DESC`
      }[options.sort]
      const orderCategoryIndex = categoryId ? categoryParameter : filterCategory ? parameters.length : undefined
      parameters.push(options.pageSize, (options.page - 1) * options.pageSize)
      const siteFields = collection === 'sites' ? ', c.target_url, c.icon_url' : ', c.cover_url'
      const subtypeFields = source.subtype ? `, c.${source.subtype}` : ''
      const categoryFields = `, COALESCE(ARRAY(SELECT link.category_id FROM ${source.categoryTable} link WHERE link.${source.categoryForeignKey} = c.id ORDER BY link.category_id), ARRAY[]::uuid[]) AS category_ids`
      const categorySettingId = collection === 'sites' && orderCategoryId
        ? `(SELECT setting_category.id FROM tree setting_tree JOIN categories setting_category ON setting_category.id = setting_tree.id WHERE setting_tree.root_id = $${orderCategoryIndex} ORDER BY CASE WHEN setting_category.id = $${orderCategoryIndex} THEN 0 ELSE 1 END, setting_category.sort_order, setting_category.id LIMIT 1)`
        : ''
      const categoryOrder = collection === 'sites' && orderCategoryId
        ? `COALESCE((SELECT settings.pinned FROM site_category_settings settings WHERE settings.site_id = c.id AND settings.category_id = ${categorySettingId}), false) DESC, COALESCE((SELECT settings.sort_order FROM site_category_settings settings WHERE settings.site_id = c.id AND settings.category_id = ${categorySettingId}), 999999), `
        : ''
      const items = (await db.query<PublicContent & Record<string, unknown>>(`${prefix} SELECT c.id, c.title, c.slug, c.${source.summary}, c.published_at${siteFields}${subtypeFields}${categoryFields}
        ${where} ORDER BY ${categoryOrder}${order}, c.id LIMIT $${parameters.length - 1} OFFSET $${parameters.length}`, parameters)).rows
      return { items, total, page: options.page, pageSize: options.pageSize }
    }
  }
}
