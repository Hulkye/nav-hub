import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { createHomepageRepository } from '../api/server/repositories/homepage'
import type { ContentDatabase } from '../api/server/repositories/content'
import { siteSettingsSchema } from '../shared/schemas/settings'
import { createAssetRepository } from '../api/server/repositories/assets'

async function setup() {
  const db = new PGlite()
  for (const migration of (await readdir(new URL('../db/migrations/', import.meta.url))).filter(file => file.endsWith('.sql')).sort())
    await db.exec(await readFile(new URL(`../db/migrations/${migration}`, import.meta.url), 'utf8'))
  const user = await db.query<{ id: string }>("INSERT INTO admins (username, password_hash) VALUES ('operator', 'hash') RETURNING id")
  const repository = createHomepageRepository({ query: (sql, parameters) => db.query(sql, parameters), transaction: callback => db.transaction(tx => callback(tx as ContentDatabase)) })
  return { db, repository, adminId: user.rows[0]!.id }
}

test('homepage modules render selected content types and exclude drafts', async () => {
  const { db, repository, adminId } = await setup()
  try {
    await db.query("INSERT INTO resources (title, slug, status) VALUES ('Public resource', 'public-resource', 'published'), ('Draft resource', 'draft-resource', 'draft')")
    const rows = await repository.replaceHomepageModules([{ moduleType: 'latest', contentType: 'resource', title: 'Resources', enabled: true, sortOrder: 0, itemLimit: 12, categoryId: null, contentIds: [] }], adminId)
    assert.equal(rows[0]!.content_type, 'resource')
    const [rendered] = await repository.renderHomepageModules()
    assert.deepEqual(rendered!.items.map(item => item.title), ['Public resource'])
    assert.equal((await db.query("SELECT count(*)::int AS count FROM admin_audit_logs WHERE resource = 'homepage_modules'")).rows[0]!.count, 1)
  } finally { await db.close() }
})

test('homepage modules persist allowlisted background and density settings', async () => {
  const { db, repository, adminId } = await setup()
  try {
    const saved = await repository.replaceHomepageModules([{ moduleType: 'latest', sortOrder: 0, background: 'accent', density: 'compact' }], adminId)
    assert.equal(saved[0]!.background, 'accent')
    assert.equal(saved[0]!.density, 'compact')
    await assert.rejects(repository.replaceHomepageModules([{ moduleType: 'latest', sortOrder: 0, background: 'url(javascript:alert(1))' }], adminId))
  } finally { await db.close() }
})

test('homepage modules preserve placement and legacy rows default to directory top', async () => {
  const { db, repository, adminId } = await setup()
  try {
    const category = await db.query<{ id: string }>("INSERT INTO categories (name, slug) VALUES ('Design', 'design') RETURNING id")
    const [saved] = await repository.replaceHomepageModules([{ moduleType: 'banner', sortOrder: 0, placement: category.rows[0]!.id, bannerText: 'Sponsored' }], adminId)
    assert.equal(saved!.placement, category.rows[0]!.id)
    await db.query("INSERT INTO homepage_modules (module_type, sort_order) VALUES ('latest', 1)")
    assert.equal((await repository.listHomepageModules(true))[1]!.placement, 'top')
  } finally { await db.close() }
})

test('homepage discovery modules order published updates, popularity and categories and persist banners', async () => {
  const { db, repository, adminId } = await setup()
  try {
    const sites = await db.query<{ id: string }>("INSERT INTO sites (title, slug, target_url, status, updated_at) VALUES ('Older', 'older', 'https://older.example', 'published', now() - interval '2 days'), ('Newer', 'newer', 'https://newer.example', 'published', now()), ('Private', 'private', 'https://private.example', 'draft', now()) RETURNING id")
    await db.query("INSERT INTO content_events (event_type, content_type, content_id, dedupe_key) VALUES ('view', 'site', $1, 'event')", [sites.rows[0]!.id])
    const category = await db.query<{ id: string }>("INSERT INTO categories (name, slug) VALUES ('Tools', 'tools') RETURNING id")
    await db.query('INSERT INTO site_categories (site_id, category_id) VALUES ($1, $2)', [sites.rows[0]!.id, category.rows[0]!.id])
    await repository.replaceHomepageModules([
      { moduleType: 'updated', sortOrder: 0 },
      { moduleType: 'popular', sortOrder: 1 },
      { moduleType: 'popular_categories', sortOrder: 2 },
      { moduleType: 'banner', sortOrder: 3, title: 'News', bannerText: 'Welcome', bannerUrl: '/articles' }
    ], adminId)
    const rendered = await repository.renderHomepageModules()
    assert.deepEqual(rendered[0]!.items.map(item => item.title), ['Newer', 'Older'])
    assert.equal(rendered[1]!.items[0]!.title, 'Older')
    assert.equal(rendered[2]!.items[0]!.title, 'Tools')
    assert.equal(rendered[3]!.banner_text, 'Welcome')
    assert.equal(rendered[3]!.banner_url, '/articles')
    await assert.rejects(repository.replaceHomepageModules([{ moduleType: 'banner', sortOrder: 0, bannerUrl: 'javascript:alert(1)' }], adminId))
  } finally { await db.close() }
})

test('legacy homepage rows default to site content and settings reject unsafe destinations', async () => {
  const { db, repository } = await setup()
  try {
    await db.query("INSERT INTO homepage_modules (module_type, sort_order) VALUES ('latest', 0)")
    assert.equal((await repository.listHomepageModules())[0]!.content_type, 'site')
    assert.equal(siteSettingsSchema.safeParse({ name: 'Site', navigation: [{ label: 'Bad', to: 'javascript:alert(1)' }], seo: {} }).success, false)
    assert.equal(siteSettingsSchema.safeParse({ name: 'Site', navigation: [{ label: 'Home', to: '/' }], seo: {} }).success, true)
  } finally { await db.close() }
})

test('settings writes persist and record an admin audit event', async () => {
  const { db, repository, adminId } = await setup()
  try {
    const settings = { name: 'Directory', logoUrl: '', description: 'Curated links', footer: 'Footer', navigation: [{ label: 'Home', to: '/' }], seo: { title: 'Directory', description: 'Curated links', keywords: '', imageUrl: '' } }
    await repository.updateSiteSettings(settings, adminId)
    assert.deepEqual(await repository.getSiteSettings(), siteSettingsSchema.parse(settings))
    assert.equal((await repository.getSiteSettings()).siteCardBehavior, 'detail')
    assert.equal((await repository.getSiteSettings()).siteCardArrowBehavior, 'direct')
    const direct = { ...siteSettingsSchema.parse(settings), siteCardBehavior: 'direct' as const }
    await repository.updateSiteSettings(direct, adminId)
    assert.equal((await repository.getSiteSettings()).siteCardBehavior, 'direct')
    assert.equal((await db.query("SELECT action FROM admin_audit_logs WHERE resource = 'site_settings'")).rows[0]!.action, 'update')
  } finally { await db.close() }
})

test('site settings accept only safe CSS variables and provide branding defaults', () => {
  const base = siteSettingsSchema.parse({ name: 'Site', navigation: [], seo: {} })
  assert.equal(base.faviconUrl, '')
  assert.deepEqual(base.customCss, { cardRadius: 'default', cardShadow: 'default' })
  assert.equal(siteSettingsSchema.safeParse({ ...base, customCss: { cardRadius: '12px', cardShadow: 'soft' } }).success, true)
  assert.equal(siteSettingsSchema.safeParse({ ...base, customCss: { cardRadius: 'url(javascript:alert(1))', cardShadow: 'soft' } }).success, false)
})

test('all homepage content types preserve featured ordering, enabled flags and announcement windows', async () => {
  const { db, repository, adminId } = await setup()
  try {
    const resource = await db.query<{ id: string }>("INSERT INTO resources (title, slug, status) VALUES ('First', 'first', 'published'), ('Second', 'second', 'published'), ('Hidden', 'hidden', 'offline') RETURNING id")
    await db.query("INSERT INTO articles (title, slug, status) VALUES ('Article', 'article', 'published'), ('Draft', 'draft', 'draft')")
    await db.query("INSERT INTO media_items (title, slug, status) VALUES ('Book', 'book', 'published')")
    await db.query("INSERT INTO sites (title, slug, target_url, status) VALUES ('Site', 'site', 'https://example.com', 'published')")
    await db.query("INSERT INTO announcements (title, status, starts_at, ends_at) VALUES ('Active', 'published', NULL, NULL), ('Future', 'published', now() + interval '1 day', NULL), ('Expired', 'published', NULL, now() - interval '1 day'), ('Draft', 'draft', NULL, NULL)")
    await repository.replaceHomepageModules([
      { moduleType: 'featured', contentType: 'resource', sortOrder: 0, contentIds: [resource.rows[1]!.id, resource.rows[2]!.id, resource.rows[0]!.id] },
      { moduleType: 'latest', contentType: 'article', sortOrder: 1 },
      { moduleType: 'latest', contentType: 'media', sortOrder: 2 },
      { moduleType: 'announcement', sortOrder: 3 },
      { moduleType: 'latest', sortOrder: 4 },
      { moduleType: 'latest', sortOrder: 5, enabled: false }
    ], adminId)
    const rendered = await repository.renderHomepageModules()
    assert.equal(rendered.length, 5)
    assert.deepEqual(rendered.map(module => module.items.map(item => item.title)), [['Second', 'First'], ['Article'], ['Book'], ['Active'], ['Site']])
    await assert.rejects(repository.replaceHomepageModules([{ moduleType: 'latest', sortOrder: 0 }], '00000000-0000-4000-8000-000000000000'))
    assert.equal((await repository.listHomepageModules(true)).length, 6)
    const settings = await repository.getSiteSettings()
    await assert.rejects(repository.updateSiteSettings({ ...settings, name: 'Unaudited' }, '00000000-0000-4000-8000-000000000000'))
    assert.equal((await repository.getSiteSettings()).name, settings.name)
  } finally { await db.close() }
})

test('settings logo, favicon and SEO images prevent asset deletion and reject deleted assets', async () => {
  const db = new PGlite()
  try {
    const directory = new URL('../db/migrations/', import.meta.url)
    for (const file of (await readdir(directory)).filter(file => file.endsWith('.sql')).sort())
      await db.exec(await readFile(new URL(file, directory), 'utf8'))
    const database: ContentDatabase = { query: (sql, parameters) => db.query(sql, parameters), transaction: callback => db.transaction(tx => callback(tx as ContentDatabase)) }
    const repository = createHomepageRepository(database)
    const assets = createAssetRepository(database)
    const admin = await db.query<{ id: string }>("INSERT INTO admins (username, password_hash) VALUES ('settings-images', 'hash') RETURNING id")
    const adminId = admin.rows[0]!.id
    const id = '00000000-0000-4000-8000-000000000001'
    await assets.create({ id, object_key: 'settings.webp', filename: 'settings.webp', content_type: 'image/webp', byte_size: 10, width: 10, height: 10 }, adminId)
    const initial = await repository.getSiteSettings()
    for (const field of ['logo', 'favicon', 'seo']) {
      const configured = { ...initial, logoUrl: field === 'logo' ? `/api/assets/${id}` : '', faviconUrl: field === 'favicon' ? `/api/assets/${id}` : '', seo: { ...initial.seo, imageUrl: field === 'seo' ? `/api/assets/${id}` : '' } }
      await repository.updateSiteSettings(configured, adminId)
      assert.equal((await assets.references(id))[0]!.field, field === 'logo' ? 'logoUrl' : field === 'favicon' ? 'faviconUrl' : 'seo.imageUrl')
      const result = await assets.remove(id, adminId, async () => { assert.fail('Referenced image must not be deleted') })
      assert.equal(result!.deleted, false)
    }
    await repository.updateSiteSettings(initial, adminId)
    assert.equal((await assets.remove(id, adminId, async () => {}))!.deleted, true)
    await assert.rejects(repository.updateSiteSettings({ ...initial, logoUrl: `/api/assets/${id}` }, adminId), /Referenced image does not exist/)
    await assert.rejects(repository.updateSiteSettings({ ...initial, faviconUrl: `/api/assets/${id}` }, adminId), /Referenced image does not exist/)
    await assert.rejects(repository.updateSiteSettings({ ...initial, seo: { ...initial.seo, imageUrl: `/api/assets/${id}` } }, adminId), /Referenced image does not exist/)
  } finally { await db.close() }
})
