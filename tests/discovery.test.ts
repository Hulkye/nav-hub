import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { createDiscoveryRepository } from '../api/server/repositories/discovery'

test('public tag aggregation and cross-type recommendations exclude unpublished content', async () => {
  const db = new PGlite()
  try {
    for (const migration of ['0001_admin_foundation', '0002_content_foundation', '0003_navigation_features', '0004_content_operations']) {
      await db.exec(await readFile(new URL(`../db/migrations/${migration}.sql`, import.meta.url), 'utf8'))
    }
    const discovery = createDiscoveryRepository(db)
    await db.query("INSERT INTO tags (name, slug) VALUES ('Design', 'design')")
    const ids: Record<string, string> = {}
    for (const [type, table] of Object.entries({ site: 'sites', resource: 'resources', media: 'media_items', article: 'articles' })) {
      const extra = type === 'site' ? ", target_url" : ''
      const value = type === 'site' ? ", 'https://example.com'" : ''
      const result = await db.query<{ id: string }>(`INSERT INTO ${table} (title, slug, status${extra}) VALUES ('${type}', '${type}', 'published'${value}) RETURNING id`)
      ids[type] = result.rows[0]!.id
    }
    const draft = (await db.query<{ id: string }>("INSERT INTO resources (title, slug, status) VALUES ('Draft', 'draft', 'draft') RETURNING id")).rows[0]!
    await db.query("INSERT INTO media_items (title, slug, status) VALUES ('Offline', 'offline', 'offline')")
    await db.query(`INSERT INTO site_tags (site_id, tag_id) SELECT $1, id FROM tags`, [ids.site])
    await db.query(`INSERT INTO resource_tags (resource_id, tag_id) SELECT $1, id FROM tags`, [ids.resource])
    await db.query(`INSERT INTO media_tags (media_id, tag_id) SELECT $1, id FROM tags`, [ids.media])
    await db.query(`INSERT INTO article_tags (article_id, tag_id) SELECT $1, id FROM tags`, [ids.article])
    await db.query("INSERT INTO tags (name, slug, sort_order) VALUES ('Specific', 'specific', -1), ('Private', 'private', 1), ('Unused', 'unused', 2)")
    await db.query("INSERT INTO resource_tags (resource_id, tag_id) SELECT $1, id FROM tags WHERE slug IN ('design', 'private')", [draft.id])
    await db.query("INSERT INTO resource_tags (resource_id, tag_id) SELECT $1, id FROM tags WHERE slug = 'specific'", [ids.resource])
    await db.query("INSERT INTO article_tags (article_id, tag_id) SELECT $1, id FROM tags WHERE slug = 'specific'", [ids.article])
    await db.query("INSERT INTO media_tags (media_id, tag_id) SELECT m.id, t.id FROM media_items m CROSS JOIN tags t WHERE m.slug = 'offline' AND t.slug = 'design'")
    await db.query(`INSERT INTO announcements (title, status, starts_at, ends_at) VALUES
      ('Active', 'published', now() - interval '1 day', now() + interval '1 day'),
      ('Upcoming', 'published', now() + interval '1 day', NULL),
      ('Expired', 'published', NULL, now() - interval '1 day')`)
    await db.query("INSERT INTO announcement_tags (announcement_id, tag_id) SELECT a.id, t.id FROM announcements a CROSS JOIN tags t WHERE t.slug = 'design'")

    const tags = await discovery.listTags()
    assert.deepEqual(tags.map(tag => [tag.slug, tag.count]), [['specific', 2], ['design', 5]])
    assert.equal(await discovery.getTag('private'), undefined)
    assert.equal(await discovery.getTag('missing'), undefined)
    const page = await discovery.getTag('design', { type: 'resource' })
    assert.equal(page!.total, 1)
    assert.deepEqual(page!.results.map(item => item.type), ['resource'])
    const announcements = await discovery.getTag('design', { type: 'announcement' })
    assert.deepEqual(announcements!.results.map(item => item.title), ['Active'])
    const all = (await discovery.getTag('design'))!.results.map(item => item.id)
    const second = await discovery.getTag('design', { page: 2, pageSize: 2 })
    assert.equal(second!.total, 5)
    assert.deepEqual(second!.results.map(item => item.id), all.slice(2, 4))
    assert.deepEqual((await discovery.getTag('design', { page: 4, pageSize: 2 }))!.results, [])
    const recommendations = await discovery.related('resource', ids.resource)
    assert.deepEqual(new Set(recommendations!.map(item => item.type)), new Set(['site', 'media', 'article']))
    assert.deepEqual(recommendations!.map(item => item.shared_tags), [2, 1, 1])
    assert.deepEqual((await discovery.related('resource', ids.resource, 1))!.map(item => item.type), ['article'])
    assert.ok((await discovery.related('media', ids.media))!.some(item => item.type === 'resource'))
    assert.ok((await discovery.related('article', ids.article))!.some(item => item.type === 'media'))
    assert.equal(await discovery.related('resource', draft.id), undefined)
    assert.equal(await discovery.related('article', ids.media), undefined)
    for (const [type, id] of Object.entries(ids)) {
      assert.ok((await discovery.detailTags(type, type === 'site' ? 'site' : id))!.some(tag => tag.slug === 'design'))
    }
    await db.query("INSERT INTO sites (title, slug, target_url, status) VALUES ('UUID slug', $1, 'https://example.com', 'published')", [ids.site])
    assert.deepEqual(await discovery.detailTags('site', ids.site!), [])
    assert.deepEqual((await discovery.detailTags('article', ids.article))!.map(tag => tag.slug), ['specific', 'design'])
    assert.equal(await discovery.detailTags('resource', draft.id), undefined)
    assert.equal(await discovery.detailTags('article', ids.media), undefined)
    for (const title of ['Active', 'Upcoming', 'Expired']) {
      const id = (await db.query<{ id: string }>('SELECT id FROM announcements WHERE title = $1', [title])).rows[0]!.id
      assert.equal((await discovery.detailTags('announcement', id))?.length, title === 'Active' ? 1 : undefined)
    }
    await assert.rejects(discovery.getTag('design', { pageSize: 51 }))
  } finally { await db.close() }
})

test('article navigation uses published date with creation fallback and stable ID ties', async () => {
  const db = new PGlite()
  try {
    await db.exec(await readFile(new URL('../db/migrations/0003_navigation_features.sql', import.meta.url), 'utf8'))
    const discovery = createDiscoveryRepository(db)
    const ids = [1, 2, 3, 4, 5].map(value => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`)
    for (const [index, id] of ids.entries()) {
      await db.query(`INSERT INTO articles (id, title, slug, status, published_at, created_at) VALUES ($1, $2, $2, 'published', $3, $4)`,
        [id, `article-${index}`, index === 4 ? null : index === 0 ? '2026-01-01' : '2026-01-02', index === 4 ? '2026-01-03' : '2025-01-01'])
    }
    await db.query("INSERT INTO articles (title, slug, status, published_at) VALUES ('Draft', 'draft', 'draft', '2026-01-02'), ('Offline', 'offline', 'offline', '2026-01-02')")
    for (const [index, id] of ids.entries()) {
      const navigation = await discovery.articleNavigation(id)
      assert.equal(navigation!.previous?.id ?? null, ids[index - 1] ?? null)
      assert.equal(navigation!.next?.id ?? null, ids[index + 1] ?? null)
    }
    const draftId = (await db.query<{ id: string }>("SELECT id FROM articles WHERE slug = 'draft'")).rows[0]!.id
    assert.equal(await discovery.articleNavigation(draftId), undefined)
    assert.equal(await discovery.articleNavigation('00000000-0000-4000-8000-000000000099'), undefined)
    await db.query('DELETE FROM articles WHERE id <> $1', [ids[0]])
    assert.deepEqual(await discovery.articleNavigation(ids[0]!), { previous: null, next: null })
  } finally { await db.close() }
})
