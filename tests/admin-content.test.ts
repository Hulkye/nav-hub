import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { createContentRepository, type ContentDatabase } from '../api/server/repositories/content'
import { adminContentSchemas, type AdminContentCollection } from '../shared/schemas/admin-content'

const samples = {
  resources: { title: 'Resource', slug: 'resource', resourceType: 'document', targetUrl: 'https://example.com/resource' },
  media: { title: 'Media', slug: 'media', mediaType: 'movie', rating: 8.5 },
  articles: { title: 'Article', slug: 'article', body: 'Article body' },
  announcements: { title: 'Announcement', body: 'Announcement body' }
}

test('admin schemas reject unknown fields, unsafe URLs, invalid types, ratings and time ranges', () => {
  for (const collection of Object.keys(samples) as AdminContentCollection[]) {
    assert.equal(adminContentSchemas[collection].safeParse(samples[collection]).success, true)
    assert.equal(adminContentSchemas[collection].safeParse({ ...samples[collection], title: ' ' }).success, false)
    assert.equal(adminContentSchemas[collection].safeParse({ ...samples[collection], status: 'invalid' }).success, false)
    assert.equal(adminContentSchemas[collection].safeParse({ ...samples[collection], injected: 'field' }).success, false)
  }
  assert.equal(adminContentSchemas.resources.safeParse({ ...samples.resources, targetUrl: 'javascript:alert(1)' }).success, false)
  assert.equal(adminContentSchemas.resources.safeParse({ ...samples.resources, resourceType: 'invalid' }).success, false)
  assert.equal(adminContentSchemas.media.safeParse({ ...samples.media, rating: 10.1 }).success, false)
  assert.equal(adminContentSchemas.media.safeParse({ ...samples.media, rating: 8.55 }).success, false)
  assert.equal(adminContentSchemas.articles.safeParse({ ...samples.articles, body: '' }).success, false)
  assert.equal(adminContentSchemas.announcements.safeParse({ ...samples.announcements, startsAt: '2026-01-02T00:00:00Z', endsAt: '2026-01-01T00:00:00Z' }).success, false)
})

test('all admin content collections create, edit, publish, unpublish and delete without exposing drafts', async () => {
  const db = new PGlite()
  try {
    for (const migration of (await readdir(new URL('../db/migrations/', import.meta.url))).filter(file => file.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(`../db/migrations/${migration}`, import.meta.url), 'utf8'))
    const repository = createContentRepository({ query: (sql, parameters) => db.query(sql, parameters), transaction: callback => db.transaction(tx => callback(tx as ContentDatabase)) })
    for (const collection of Object.keys(samples) as AdminContentCollection[]) {
      const sample = samples[collection]
      const created = await repository.createAdminContent(collection, sample)
      const id = String(created!.id)
      assert.equal(created!.status, 'draft')
      assert.equal((await repository.listAdminContent(collection)).length, 1)
      assert.equal((await repository.listPublishedContent(collection)).length, 0)
      assert.equal((await repository.getAdminContent(collection, id))!.title, sample.title)
      await repository.updateAdminContent(collection, id, { ...sample, title: 'Edited', status: 'published' })
      const published = await repository.listPublishedContent(collection)
      assert.equal(published.length, 1)
      assert.equal(published[0]!.title, 'Edited')
      if (collection !== 'announcements') assert.ok(published[0]!.published_at)
      await repository.updateAdminContent(collection, id, { ...sample, status: 'offline' })
      assert.equal((await repository.listPublishedContent(collection)).length, 0)
      await repository.deleteAdminContent(collection, id)
      assert.equal(await repository.getAdminContent(collection, id), undefined)
      assert.equal(await repository.updateAdminContent(collection, id, sample), undefined)
      assert.equal(await repository.deleteAdminContent(collection, id), undefined)
    }
    const future = await repository.createAdminContent('announcements', { ...samples.announcements, status: 'published', startsAt: '2099-01-01T00:00:00Z' })
    assert.ok(future)
    assert.equal((await repository.listPublishedContent('announcements')).length, 0)
    await assert.rejects(repository.createAdminContent('resources', { ...samples.resources, targetUrl: 'file:///etc/passwd' }))
    await assert.rejects(repository.deleteAdminContent('resources', 'invalid-id'))
  } finally { await db.close() }
})
