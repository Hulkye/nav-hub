import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { createContentRepository, type ContentDatabase } from '../api/server/repositories/content'

async function setup() {
  const db = new PGlite()
  for (const migration of (await readdir(new URL('../db/migrations/', import.meta.url))).filter(file => file.endsWith('.sql')).sort()) {
    await db.exec(await readFile(new URL(`../db/migrations/${migration}`, import.meta.url), 'utf8'))
  }
  const repository = createContentRepository({
    query: (sql, parameters) => db.query(sql, parameters),
    transaction: callback => db.transaction(tx => callback(tx as ContentDatabase))
  })
  return { db, repository }
}

test('admin site and content lists filter and paginate with capped page size', async () => {
  const { db, repository } = await setup()
  try {
    const category = await repository.createCategory({ name: 'Tools', slug: 'tools', description: '', parentId: null, sortOrder: 0 })
    for (let index = 1; index <= 25; index++) {
      await db.query('INSERT INTO sites (title, slug, description, target_url, status) VALUES ($1, $2, $3, $4, $5)', [`Tool ${index}`, `tool-${index}`, 'Directory entry', `https://tool${index}.example`, index % 2 ? 'published' : 'draft'])
      await db.query('INSERT INTO resources (title, slug, description, status) VALUES ($1, $2, $3, $4)', [`Resource ${index}`, `resource-${index}`, index === 3 ? 'needle match' : 'other', index % 2 ? 'published' : 'draft'])
    }
    const sites = await db.query<{ id: string }>("SELECT id FROM sites WHERE slug = 'tool-1'")
    await db.query('INSERT INTO site_categories (site_id, category_id) VALUES ($1, $2)', [sites.rows[0]!.id, category!.id])

    const page = await repository.listAdminSites({ page: 2, pageSize: 10 })
    assert.equal(page.total, 25)
    assert.equal(page.items.length, 10)
    assert.equal(page.pageCount, 3)
    const filtered = await repository.listAdminSites({ status: 'published', q: 'Tool 1', categoryId: category!.id })
    assert.equal(filtered.total, 1)
    assert.equal(filtered.items[0]!.slug, 'tool-1')
    const content = await repository.listAdminContent('resources', { status: 'published', q: 'needle', pageSize: 10 })
    assert.equal(content.total, 1)
    assert.equal(content.items[0]!.slug, 'resource-3')
    await assert.rejects(repository.listAdminSites({ pageSize: 101 }))
    await assert.rejects(repository.listAdminContent('resources', { page: 0 }))
  } finally { await db.close() }
})

test('category and tag edits preserve associations and deletes clean up safely', async () => {
  const { db, repository } = await setup()
  try {
    const parent = await repository.createCategory({ name: 'Parent', slug: 'parent', description: '', parentId: null, sortOrder: 0 })
    const child = await repository.createCategory({ name: 'Child', slug: 'child', description: '', parentId: parent!.id, sortOrder: 1 })
    await assert.rejects(repository.updateCategory(parent!.id, { name: 'Parent', slug: 'parent', description: '', parentId: child!.id, sortOrder: 0 }), /CATEGORY_PARENT_CYCLE/)
    const updated = await repository.updateCategory(child!.id, { name: 'Renamed', slug: 'renamed', description: 'Updated', parentId: null, sortOrder: 4 })
    assert.equal(updated!.name, 'Renamed')
    assert.equal(updated!.sort_order, 4)

    const tag = await repository.createTag({ name: 'Old tag', slug: 'old-tag', description: '' })
    const site = await db.query<{ id: string }>("INSERT INTO sites (title, slug, target_url) VALUES ('Tagged', 'tagged', 'https://tagged.example') RETURNING id")
    await db.query('INSERT INTO site_categories (site_id, category_id) VALUES ($1, $2)', [site.rows[0]!.id, child!.id])
    await db.query('INSERT INTO site_tags (site_id, tag_id) VALUES ($1, $2)', [site.rows[0]!.id, tag!.id])
    await repository.updateTag(tag!.id, { name: 'New tag', slug: 'new-tag', description: 'Updated' })
    assert.equal((await db.query('SELECT tag_id FROM site_tags WHERE site_id = $1', [site.rows[0]!.id])).rows[0]!.tag_id, tag!.id)
    await repository.deleteTag(tag!.id)
    assert.equal((await db.query('SELECT * FROM site_tags WHERE site_id = $1', [site.rows[0]!.id])).rows.length, 0)

    await repository.deleteCategory(child!.id)
    assert.equal((await db.query('SELECT * FROM site_categories WHERE site_id = $1', [site.rows[0]!.id])).rows.length, 0)
    const parentDelete = await repository.createCategory({ name: 'Root', slug: 'root', description: '', parentId: null, sortOrder: 0 })
    const nested = await repository.createCategory({ name: 'Nested', slug: 'nested', description: '', parentId: parentDelete!.id, sortOrder: 0 })
    await repository.deleteCategory(parentDelete!.id)
    assert.equal((await db.query('SELECT parent_id FROM categories WHERE id = $1', [nested!.id])).rows[0]!.parent_id, null)
  } finally { await db.close() }
})
