import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { createContentRepository, type ContentDatabase } from '../api/server/repositories/content'
import { categorySchema, tagSchema } from '../shared/schemas/content'

async function setup() {
  const db = new PGlite()
  for (const migration of (await readdir(new URL('../db/migrations/', import.meta.url))).filter(file => file.endsWith('.sql')).sort()) {
    await db.exec(await readFile(new URL(`../db/migrations/${migration}`, import.meta.url), 'utf8'))
  }
  const repository = createContentRepository({
    query: (sql, parameters) => db.query(sql, parameters),
    transaction: (callback) => db.transaction((tx) => callback(tx as ContentDatabase))
  })
  return { db, repository }
}

test('taxonomy icons are validated, persisted, exposed and explicitly cleared', async () => {
  assert.equal(categorySchema.safeParse({ name: 'Category', slug: 'category', iconName: 'NotAnIcon' }).success, false)
  assert.equal(tagSchema.safeParse({ name: 'Tag', slug: 'tag', iconName: '<svg>' }).success, false)
  const { db, repository } = await setup()
  try {
    const input = categorySchema.parse({ name: 'Community', slug: 'community', iconName: 'People' })
    const category = await repository.createCategory(input)
    assert.equal(category?.icon_name, 'People')
    assert.equal((await repository.listCategories())[0]?.icon_name, 'People')
    assert.equal((await repository.listPublicCategories())[0]?.icon_name, 'People')
    const categoryId = String(category!.id)
    const { iconName, ...withoutIcon } = input
    assert.equal((await repository.updateCategory(categoryId, withoutIcon))?.icon_name, 'People')
    assert.equal((await repository.updateCategory(categoryId, { ...input, iconName: 'Book' }))?.icon_name, 'Book')
    assert.equal((await repository.updateCategory(categoryId, { ...input, iconName: null }))?.icon_name, null)

    const tagInput = tagSchema.parse({ name: 'Learning', slug: 'learning', iconName: 'ReadBook' })
    const tag = await repository.createTag(tagInput)
    assert.equal(tag?.icon_name, 'ReadBook')
    assert.equal((await repository.listTags())[0]?.icon_name, 'ReadBook')
    const { iconName: tagIcon, ...tagWithoutIcon } = tagInput
    assert.equal((await repository.updateTag(String(tag!.id), tagWithoutIcon))?.icon_name, 'ReadBook')
    assert.equal((await repository.updateTag(String(tag!.id), { ...tagInput, iconName: null }))?.icon_name, null)
  } finally {
    await db.close()
  }
})

test('submission review locks pending row and atomically publishes/audits once', async () => {
  const { db, repository } = await setup()
  try {
    const admin = await db.query<{ id: string }>("INSERT INTO admins (username, password_hash) VALUES ('reviewer', 'hash') RETURNING id")
    const submission = await db.query<{ id: string }>(`INSERT INTO guest_submissions (content_type, payload) VALUES ('site', '{"title":"Approved","slug":"approved","targetUrl":"https://example.com"}') RETURNING id`)
    const id = submission.rows[0]!.id
    const results = await Promise.all([
      repository.reviewSubmission(id, 'approved', null, admin.rows[0]!.id),
      repository.reviewSubmission(id, 'approved', null, admin.rows[0]!.id)
    ])
    assert.equal(results.filter(Boolean).length, 1)
    assert.equal((await db.query("SELECT id FROM sites WHERE slug = 'approved'")).rows.length, 1)
    assert.equal((await db.query("SELECT id FROM admin_audit_logs WHERE resource = 'guest_submission'")).rows.length, 1)
    assert.equal((await db.query('SELECT status FROM guest_submissions WHERE id = $1', [id])).rows[0]!.status, 'approved')
    assert.equal((await db.query("SELECT count(*)::int AS count FROM moderation_reviews WHERE item_id = $1", [id])).rows[0]!.count, 1)
  } finally {
    await db.close()
  }
})

test('each submission type is schema-validated and published with its taxonomy links', async () => {
  const { db, repository } = await setup()
  try {
    const admin = await db.query<{ id: string }>("INSERT INTO admins (username, password_hash) VALUES ('moderator', 'hash') RETURNING id")
    const tag = await repository.createTag({ name: 'Reviewed', slug: 'reviewed', description: '' })
    const cases = [
      { type: 'site', payload: { title: 'Site submit', slug: 'site-submit', description: 'desc', targetUrl: 'https://site.example' }, table: 'sites', linkTable: 'site_tags', linkColumn: 'site_id' },
      { type: 'resource', payload: { title: 'Resource submit', slug: 'resource-submit', targetUrl: 'https://resource.example', resourceType: 'software' }, table: 'resources', linkTable: 'resource_tags', linkColumn: 'resource_id' },
      { type: 'media', payload: { title: 'Media submit', slug: 'media-submit', mediaType: 'book', rating: 8 }, table: 'media_items', linkTable: 'media_tags', linkColumn: 'media_id' },
      { type: 'article', payload: { title: 'Article submit', slug: 'article-submit', summary: 'summary', body: 'article body' }, table: 'articles', linkTable: 'article_tags', linkColumn: 'article_id' }
    ] as const
    for (const item of cases) {
      const submission = await db.query<{ id: string }>('INSERT INTO guest_submissions (content_type, payload) VALUES ($1, $2) RETURNING id', [item.type, JSON.stringify(item.payload)])
      const result = await repository.reviewSubmission(submission.rows[0]!.id, 'approved', null, admin.rows[0]!.id, item.payload, [], [String(tag!.id)])
      assert.ok(result?.published_content_id)
      assert.equal((await db.query(`SELECT status FROM ${item.table} WHERE id = $1`, [result!.published_content_id])).rows[0]!.status, 'published')
      assert.equal((await db.query(`SELECT count(*)::int AS count FROM ${item.linkTable} WHERE ${item.linkColumn} = $1 AND tag_id = $2`, [result!.published_content_id, tag!.id])).rows[0]!.count, 1)
    }
    assert.equal((await db.query('SELECT count(*)::int AS count FROM moderation_reviews')).rows[0]!.count, 4)
    const invalid = await db.query<{ id: string }>("INSERT INTO guest_submissions (content_type, payload) VALUES ('site', '{\"title\":\"Unsafe\",\"targetUrl\":\"javascript:alert(1)\"}') RETURNING id")
    await assert.rejects(repository.reviewSubmission(invalid.rows[0]!.id, 'approved', null, admin.rows[0]!.id))
  } finally { await db.close() }
})

test('moderation queues filter and paginate without returning comment email', async () => {
  const { db, repository } = await setup()
  try {
    await db.query("INSERT INTO guest_submissions (content_type, payload, status) VALUES ('site', '{\"title\":\"one\"}', 'pending'), ('media', '{\"title\":\"two\"}', 'approved')")
    const filtered = await repository.listSubmissions({ status: 'pending', contentType: 'site', page: 1, pageSize: 1 })
    assert.equal(filtered.total, 1)
    assert.equal(filtered.items.length, 1)
    await db.query("INSERT INTO comments (content_type, content_id, display_name, email, body, status) VALUES ('site', gen_random_uuid(), 'Reader', 'private@example.com', 'Public comment text', 'pending')")
    const comments = await repository.listComments({ status: 'pending', page: 1, pageSize: 10 })
    assert.equal(comments.total, 1)
    assert.equal('email' in comments.items[0]!, false)
  } finally { await db.close() }
})

test('site update rolls back primary and relation changes when a relation insert fails', async () => {
  const { db, repository } = await setup()
  try {
    const category = await db.query<{ id: string }>("INSERT INTO categories (name, slug) VALUES ('Original', 'original') RETURNING id")
    const tag = await db.query<{ id: string }>("INSERT INTO tags (name, slug) VALUES ('Original', 'original') RETURNING id")
    const site = await db.query<{ id: string }>("INSERT INTO sites (title, slug, target_url) VALUES ('Original', 'original', 'https://old.example') RETURNING id")
    await db.query('INSERT INTO site_categories (site_id, category_id) VALUES ($1, $2)', [site.rows[0]!.id, category.rows[0]!.id])
    await db.query('INSERT INTO site_tags (site_id, tag_id) VALUES ($1, $2)', [site.rows[0]!.id, tag.rows[0]!.id])

    await assert.rejects(repository.updateSite(site.rows[0]!.id, {
      title: 'Changed', slug: 'changed', description: '', targetUrl: 'https://new.example', iconUrl: null,
      status: 'draft', sortOrder: 1, categoryIds: [category.rows[0]!.id, category.rows[0]!.id], tagIds: []
    }))

    const savedSite = await db.query<{ title: string; slug: string; target_url: string }>('SELECT title, slug, target_url FROM sites WHERE id = $1', [site.rows[0]!.id])
    assert.deepEqual(savedSite.rows[0], { title: 'Original', slug: 'original', target_url: 'https://old.example' })
    assert.deepEqual((await db.query('SELECT category_id FROM site_categories WHERE site_id = $1', [site.rows[0]!.id])).rows, [{ category_id: category.rows[0]!.id }])
    assert.deepEqual((await db.query('SELECT tag_id FROM site_tags WHERE site_id = $1', [site.rows[0]!.id])).rows, [{ tag_id: tag.rows[0]!.id }])
  } finally {
    await db.close()
  }
})
