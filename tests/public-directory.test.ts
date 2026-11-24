import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { createPublicDirectoryRepository } from '../api/server/repositories/public-directory'
import { parsePublicList } from '../shared/schemas/public-list'
import { searchSourceSchema, searchSourceUrl } from '../shared/schemas/search-sources'
import { defaultSiteSettings, siteSettingsSchema } from '../shared/schemas/settings'

async function setup() {
  const db = new PGlite()
  const directory = new URL('../db/migrations/', import.meta.url)
  for (const migration of (await readdir(directory)).filter(file => file.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(migration, directory), 'utf8'))
  return { db, repository: createPublicDirectoryRepository(db) }
}

test('homepage previews are limited independently per category and include all descendants without duplicates', async () => {
  const { db, repository } = await setup()
  try {
    await db.exec("INSERT INTO categories (name, slug) VALUES ('Root', 'root'), ('Other', 'other'); INSERT INTO categories (name, slug, parent_id) SELECT 'Child', 'child', id FROM categories WHERE slug = 'root'; INSERT INTO categories (name, slug, parent_id) SELECT 'Grandchild', 'grandchild', id FROM categories WHERE slug = 'child'")
    await db.exec(`INSERT INTO sites (title, slug, target_url, status, sort_order)
      SELECT 'Site ' || n, 'site-' || n, 'https://example.com/' || n, 'published', n FROM generate_series(1, 30) n;
      INSERT INTO sites (title, slug, target_url, status) VALUES ('Private', 'private', 'https://example.com', 'draft');
      INSERT INTO site_categories SELECT s.id, c.id FROM sites s CROSS JOIN categories c
      WHERE (s.sort_order <= 15 AND c.slug = 'root') OR (s.sort_order > 15 AND c.slug = 'grandchild');
      INSERT INTO site_categories SELECT s.id, c.id FROM sites s CROSS JOIN categories c WHERE s.slug = 'site-1' AND c.slug = 'child'`)
    const home = await repository.homepageCategories()
    const root = home.categories.find(category => category.slug === 'root')!
    const child = home.categories.find(category => category.slug === 'child')!
    assert.equal(home.total, 30)
    assert.equal(root.total, 30)
    assert.equal(root.sites.length, 12)
    assert.equal(child.total, 16)
    assert.equal(child.sites.length, 12)
    assert.ok(child.sites.some(site => site.slug === 'site-16'))
    assert.equal(home.categories.find(category => category.slug === 'other')!.total, 0)
    const page = (await repository.category('root', { page: 2, pageSize: 20 }))!
    assert.equal(page.total, 30)
    assert.equal(page.items.length, 10)
    assert.deepEqual(page.children.map(child => child.slug), ['child'])
    assert.equal(await repository.category('missing', {}), undefined)
    assert.equal((await repository.category('root', { q: 'Private' }))!.total, 0)
    const operator = await db.query<{ id: string }>("INSERT INTO admins (username, password_hash) VALUES ('sort-admin', 'hash') RETURNING id")
    const categoryItems = (await repository.listCategorySites(root.id))!.items
    const sorted = categoryItems.map((site, index) => ({ id: site.id, pinned: index === 2, sortOrder: categoryItems.length - index }))
    assert.equal(await repository.reorderCategorySites(root.id, sorted, operator.rows[0]!.id), sorted.length)
    assert.equal((await repository.listCategorySites(root.id))!.items[0]!.id, sorted[2]!.id)
    const reorderedHome = (await repository.homepageCategories()).categories.find(category => category.slug === 'root')!
    assert.equal(reorderedHome.sites[0]!.id, sorted[2]!.id)
    await assert.rejects(repository.reorderCategorySites(root.id, [], operator.rows[0]!.id), /INVALID_CATEGORY_SITE_ORDER/)
    assert.equal((await db.query("SELECT count(*)::int AS count FROM admin_audit_logs WHERE action = 'reorder_sites'")).rows[0]!.count, 1)
  } finally { await db.close() }
})

test('public lists page beyond 100 rows, filter types/tags and literal keywords, and sort with stable ties', async () => {
  const { db, repository } = await setup()
  try {
    for (const table of ['resources', 'media_items', 'articles']) {
      await db.exec(`INSERT INTO ${table} (title, slug, status, created_at, published_at, updated_at)
        SELECT 'Item ' || lpad(n::text, 3, '0'), 'item-' || n, 'published', '2026-01-01', '2026-01-02', '2026-01-03' FROM generate_series(1, 105) n;
        INSERT INTO ${table} (title, slug, status) VALUES ('Private', 'private', 'draft'), ('Offline', 'offline', 'offline')`)
    }
    for (const collection of ['resources', 'media', 'articles'] as const) {
      const all = await repository.list(collection, { sort: 'title', pageSize: 50 })
      const last = await repository.list(collection, { sort: 'title', page: 3, pageSize: 50 })
      assert.equal(all.total, 105)
      assert.deepEqual(last.items.map(item => item.title), ['Item 101', 'Item 102', 'Item 103', 'Item 104', 'Item 105'])
      assert.equal((await repository.list(collection, { page: 7 })).items.length, 0)
      const first = await repository.list(collection, { pageSize: 1 })
      const second = await repository.list(collection, { pageSize: 1, page: 2 })
      assert.notEqual(first.items[0]!.id, second.items[0]!.id)
      assert.equal((await repository.list(collection, { q: '%' })).total, 0)
      assert.equal((await repository.list(collection, { q: '_' })).total, 0)
    }
    await db.exec("UPDATE resources SET resource_type = 'document' WHERE slug = 'item-1'; UPDATE media_items SET media_type = 'movie' WHERE slug = 'item-2'; INSERT INTO tags (name, slug) VALUES ('Tools', 'tools'); INSERT INTO article_tags SELECT a.id, t.id FROM articles a CROSS JOIN tags t WHERE a.slug = 'item-3'")
    assert.equal((await repository.list('resources', { subtype: 'document' })).total, 1)
    assert.equal((await repository.list('media', { subtype: 'movie' })).items[0]!.slug, 'item-2')
    assert.equal((await repository.list('articles', { tag: 'tools' })).items[0]!.slug, 'item-3')
    await db.exec("UPDATE articles SET updated_at = '2026-10-01' WHERE slug = 'item-4'; INSERT INTO content_events (event_type, content_type, content_id, dedupe_key) SELECT 'view', 'article', id, 'hit' FROM articles WHERE slug = 'item-5'")
    assert.equal((await repository.list('articles', { sort: 'updated' })).items[0]!.slug, 'item-4')
    assert.equal((await repository.list('articles', { sort: 'popular' })).items[0]!.slug, 'item-5')
    assert.equal((await repository.list('articles', { q: 'Item 005', tag: 'tools' })).total, 0)
    await db.exec("INSERT INTO categories (name, slug) VALUES ('Learning', 'learning'); INSERT INTO resource_categories SELECT r.id, c.id FROM resources r CROSS JOIN categories c WHERE r.slug IN ('item-6', 'item-7') AND c.slug = 'learning'")
    const categoryFiltered = await repository.list('resources', { category: 'learning', pageSize: 20 })
    assert.deepEqual(categoryFiltered.items.map(item => item.slug).sort(), ['item-6', 'item-7'])
    const category = await db.query<{ id: string }>("SELECT id FROM categories WHERE slug = 'learning'")
    await db.query("INSERT INTO articles (title, slug, body, status) VALUES ('Categorized', 'categorized', '## Heading', 'published')")
    await db.query("INSERT INTO article_categories (article_id, category_id) SELECT a.id, $1 FROM articles a WHERE a.slug = 'categorized'", [category.rows[0]!.id])
    const listedArticle = await repository.list('articles', { category: 'learning' })
    assert.deepEqual(listedArticle.items.map(item => item.slug), ['categorized'])
    for (const query of [{ page: 0 }, { pageSize: 51 }, { sort: 'invalid' }, { q: ['array'] }, { subtype: 'movie' }]) assert.throws(() => parsePublicList('resources', query))
  } finally { await db.close() }
})

test('search sources encode user text and reject unsafe, ambiguous or disabled default templates', () => {
  const source = { id: 'test', label: 'Test', enabled: true, urlTemplate: 'https://example.com/search?q={query}' }
  const query = '中文 & # /?='
  assert.equal(new URL(searchSourceUrl(source.urlTemplate, query)).searchParams.get('q'), query)
  for (const urlTemplate of ['javascript:{query}', 'http://example.com/?q={query}', 'https://user:pass@example.com/?q={query}', 'https://{query}.example.com/', 'https://example.com/', 'https://example.com/#{query}', 'https://example.com/{query}?q={query}'])
    assert.equal(searchSourceSchema.safeParse({ ...source, urlTemplate }).success, false)
  assert.equal(siteSettingsSchema.safeParse({ ...defaultSiteSettings, searchSources: [source], defaultSearchSource: 'test' }).success, true)
  assert.equal(siteSettingsSchema.safeParse({ ...defaultSiteSettings, searchSources: [{ ...source, enabled: false }], defaultSearchSource: 'test' }).success, false)
  assert.equal(siteSettingsSchema.safeParse({ ...defaultSiteSettings, searchSources: [source, source] }).success, false)
  assert.equal(siteSettingsSchema.safeParse({ ...defaultSiteSettings, searchSources: [{ ...source, id: 'internal' }] }).success, false)
  const { searchSources, defaultSearchSource, ...legacy } = defaultSiteSettings
  assert.equal(siteSettingsSchema.parse(legacy).defaultSearchSource, 'internal')
})
