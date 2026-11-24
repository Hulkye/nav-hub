import { homepageModulesSchema, type HomepageModuleInput } from '../../../shared/schemas/homepage'
import { defaultSiteSettings, siteSettingsSchema, type SiteSettings } from '../../../shared/schemas/settings'
import type { ContentDatabase } from './content'

type ModuleRow = Record<string, unknown> & { id: string; module_type: HomepageModuleInput['moduleType']; content_type: HomepageModuleInput['contentType']; item_limit: number; category_id: string | null; content_ids: string[]; banner_text: string; banner_url: string; background: HomepageModuleInput['background']; density: HomepageModuleInput['density'] }
const sources = {
  site: { table: 'sites', fields: 'c.slug, c.description, c.target_url, c.icon_url', order: 'c.published_at DESC NULLS LAST, c.created_at DESC' },
  resource: { table: 'resources', fields: 'c.slug, c.description, c.cover_url, c.resource_type', order: 'c.published_at DESC NULLS LAST, c.created_at DESC' },
  media: { table: 'media_items', fields: 'c.slug, c.description, c.cover_url, c.media_type, c.rating', order: 'c.published_at DESC NULLS LAST, c.created_at DESC' },
  article: { table: 'articles', fields: 'c.slug, c.summary, c.cover_url', order: 'c.published_at DESC NULLS LAST, c.created_at DESC' },
  announcement: { table: 'announcements', fields: 'c.body', order: 'c.created_at DESC' }
} as const

export function createHomepageRepository(db: ContentDatabase) {
  return {
    async listHomepageModules(admin = false) {
      return (await db.query<ModuleRow>(`SELECT * FROM homepage_modules ${admin ? '' : 'WHERE enabled = true'} ORDER BY sort_order, id`)).rows
    },
    async replaceHomepageModules(rawModules: unknown, adminId: string) {
      const { modules } = homepageModulesSchema.parse({ modules: rawModules })
      return db.transaction(async tx => {
        for (const module of modules) {
          if (module.placement !== 'top') {
            const category = await tx.query<{ id: string }>('SELECT id FROM categories WHERE id = $1', [module.placement])
            if (!category.rows.length) throw createError({ statusCode: 400, statusMessage: '插入位置对应的分类不存在' })
          }
        }
        await tx.query("SELECT pg_advisory_xact_lock(714001)")
        await tx.query('DELETE FROM homepage_modules')
        const rows: ModuleRow[] = []
        for (const module of modules) {
          const result = await tx.query<ModuleRow>(`INSERT INTO homepage_modules (module_type, content_type, placement, title, enabled, sort_order, item_limit, category_id, content_ids, banner_text, banner_url, background, density) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::uuid[], $10, $11, $12, $13) RETURNING *`, [module.moduleType, module.moduleType === 'announcement' ? 'announcement' : module.contentType, module.placement, module.title, module.enabled, module.sortOrder, module.itemLimit, module.categoryId, module.contentIds, module.bannerText, module.bannerUrl, module.background, module.density])
          rows.push(result.rows[0]!)
        }
        await tx.query('INSERT INTO admin_audit_logs (admin_id, action, resource) VALUES ($1, $2, $3)', [adminId, 'replace', 'homepage_modules'])
        return rows
      })
    },
    async renderHomepageModules() {
      const modules = await this.listHomepageModules()
      return Promise.all(modules.map(async module => {
        if (module.module_type === 'banner') return { ...module, items: [] }
        if (module.module_type === 'popular_categories') {
          const { rows } = await db.query(`SELECT cat.id, cat.name AS title, cat.slug, cat.description, count(DISTINCT s.id)::int AS site_count FROM categories cat JOIN site_categories sc ON sc.category_id = cat.id JOIN sites s ON s.id = sc.site_id AND s.status = 'published' GROUP BY cat.id ORDER BY count(DISTINCT s.id) DESC, cat.sort_order, cat.id LIMIT $1`, [module.item_limit])
          return { ...module, items: rows }
        }
        const contentType = module.module_type === 'announcement' ? 'announcement' : module.content_type
        const source = sources[contentType]
        const parameters: unknown[] = []
        const filters = ["c.status = 'published'"]
        if (contentType === 'announcement') filters.push('(c.starts_at IS NULL OR c.starts_at <= now())', '(c.ends_at IS NULL OR c.ends_at > now())')
        if (module.module_type === 'featured') {
          parameters.push(module.content_ids)
          filters.push('c.id = ANY($1::uuid[])')
        }
        if (module.module_type === 'category') {
          parameters.push(module.category_id)
          filters.push('EXISTS (SELECT 1 FROM site_categories sc WHERE sc.site_id = c.id AND sc.category_id = $1)')
        }
        parameters.push(module.item_limit)
        const categoryFields = contentType === 'site' ? ', ARRAY(SELECT sc.category_id FROM site_categories sc WHERE sc.site_id = c.id) AS category_ids' : ''
        const order = module.module_type === 'featured' ? 'array_position($1::uuid[], c.id)' : module.module_type === 'updated' ? 'c.updated_at DESC' : module.module_type === 'popular' ? `(SELECT count(*) FROM content_events e WHERE e.content_id = c.id AND e.content_type = '${contentType}' AND e.occurred_at >= now() - interval '7 days' AND e.occurred_at <= now()) DESC` : source.order
        const categoryOrder = module.module_type === 'category' && contentType === 'site'
          ? `COALESCE((SELECT pinned FROM site_category_settings WHERE site_id = c.id AND category_id = $1), false) DESC, COALESCE((SELECT sort_order FROM site_category_settings WHERE site_id = c.id AND category_id = $1), 999999), `
          : ''
        const { rows } = await db.query(`SELECT c.id, c.title, ${source.fields}${categoryFields} FROM ${source.table} c WHERE ${filters.join(' AND ')} ORDER BY ${categoryOrder}${order}, c.id LIMIT $${parameters.length}`, parameters)
        return { ...module, content_type: contentType, items: rows }
      }))
    },
    async getSiteSettings(): Promise<SiteSettings> {
      const result = await db.query<{ settings: SiteSettings }>('SELECT settings FROM site_settings WHERE id = 1')
      return siteSettingsSchema.parse(result.rows[0]?.settings ?? defaultSiteSettings)
    },
    async updateSiteSettings(rawSettings: unknown, adminId: string) {
      const settings = siteSettingsSchema.parse(rawSettings)
      return db.transaction(async tx => {
        await tx.query(`INSERT INTO site_settings (id, settings) VALUES (1, $1::jsonb) ON CONFLICT (id) DO UPDATE SET settings = EXCLUDED.settings, updated_at = now()`, [JSON.stringify(settings)])
        await tx.query('INSERT INTO admin_audit_logs (admin_id, action, resource) VALUES ($1, $2, $3)', [adminId, 'update', 'site_settings'])
        return settings
      })
    }
  }
}
