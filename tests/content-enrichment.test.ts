import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { resourceSchema, mediaSchema } from '../shared/schemas/admin-content'
import { enrichmentValues } from '../api/server/repositories/content-enrichment'
import { createContentRepository, type ContentDatabase } from '../api/server/repositories/content'
import { csvExport, csvImportRows, validateImportRow, whitelistExport } from '../api/server/utils/content-transfer'

const resource = { title: 'Tool', slug: 'tool', targetUrl: 'https://example.com/tool', platforms: ['macOS', 'Windows'], version: '2.0', screenshots: ['https://example.com/screenshot.webp'], downloadSources: [{ label: 'Mirror', url: 'https://example.com/download', extractionCode: 'abc1' }], versionHistory: [{ version: '1.0', releasedAt: '2026-01-01', notes: 'Initial version' }] }

test('repository create and update persist enrichment for admin and published reads', async () => {
  const db = new PGlite()
  try {
    for (const file of (await readdir(new URL('../db/migrations/', import.meta.url))).filter(file => file.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(`../db/migrations/${file}`, import.meta.url), 'utf8'))
    const repository = createContentRepository({ query: (sql, parameters) => db.query(sql, parameters), transaction: callback => db.transaction(tx => callback(tx as ContentDatabase)) })
    const media = { title: 'Movie', slug: 'movie', mediaType: 'movie', author: 'Screenwriter', director: 'Director', publisher: 'Studio', releaseDate: '2026-11-20', channels: [{ kind: 'watch', label: 'Streaming', url: 'https://example.com/watch' }] }
    for (const [collection, input, fields] of [
      ['resources', resource, { platforms: resource.platforms, version: resource.version, screenshots: resource.screenshots, download_sources: resource.downloadSources, version_history: resource.versionHistory }],
      ['media', media, { author: media.author, director: media.director, publisher: media.publisher, channels: media.channels }]
    ] as const) {
      const created = await repository.createAdminContent(collection, input)
      const id = String(created!.id)
      for (const [field, value] of Object.entries(fields)) assert.deepEqual(created![field], value)
      assert.equal(await repository.getPublishedContent(collection, input.slug), undefined)
      const updatedInput = collection === 'resources'
        ? { ...resource, version: '3.0', platforms: ['Linux'], downloadSources: [{ label: 'New mirror', url: 'https://example.com/new', extractionCode: 'new1' }], status: 'published' }
        : { ...media, director: 'New director', releaseDate: '2026-12-01', channels: [{ kind: 'watch', label: 'New streaming', url: 'https://example.com/new-watch' }], status: 'published' }
      await repository.updateAdminContent(collection, id, updatedInput)
      const admin = (await repository.getAdminContent(collection, id))!
      const published = (await repository.getPublishedContent(collection, input.slug))!
      const listed = (await repository.listPublishedContent(collection))[0]!
      const expected = collection === 'resources' ? { ...fields, version: '3.0', platforms: ['Linux'], download_sources: updatedInput.downloadSources } : { ...fields, director: 'New director', channels: updatedInput.channels }
      for (const row of [admin, published, listed]) {
        for (const [field, value] of Object.entries(expected)) assert.deepEqual(row[field], value)
        if (collection === 'media') assert.equal(new Date(String(row.release_date)).toISOString().slice(0, 10), '2026-12-01')
      }
      const legacy = collection === 'resources' ? { title: 'Old', slug: 'old-resource', targetUrl: 'https://example.com/old' } : { title: 'Old', slug: 'old-media' }
      const old = await repository.createAdminContent(collection, legacy)
      assert.deepEqual(old![collection === 'resources' ? 'download_sources' : 'channels'], [])
    }
  } finally { await db.close() }
})

test('enrichment validates safe bounded downloads and typed media channels while defaulting legacy records', () => {
  assert.deepEqual(resourceSchema.parse({ title: 'Old', slug: 'old', targetUrl: 'https://example.com' }).downloadSources, [])
  assert.deepEqual(mediaSchema.parse({ title: 'Old book', slug: 'old-book' }).channels, [])
  assert.equal(resourceSchema.safeParse(resource).success, true)
  for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'https://user:password@example.com']) assert.equal(resourceSchema.safeParse({ ...resource, downloadSources: [{ label: 'Unsafe', url }] }).success, false)
  assert.equal(resourceSchema.safeParse({ ...resource, screenshots: Array(13).fill('https://example.com/a') }).success, false)
  assert.equal(resourceSchema.safeParse({ ...resource, versionHistory: [{ version: '1', releasedAt: '2026-02-30' }] }).success, false)
  for (const [mediaType, kind] of [['book', 'read'], ['movie', 'watch'], ['music', 'listen']]) {
    assert.equal(mediaSchema.safeParse({ title: 'Media', slug: 'media', mediaType, channels: [{ kind, label: 'Official', url: 'https://example.com' }] }).success, true)
  }
  assert.equal(mediaSchema.safeParse({ title: 'Book', slug: 'book', channels: [{ kind: 'watch', label: 'Wrong', url: 'https://example.com' }] }).success, false)
})

test('migration defaults and helper persist enrichment; CSV and JSON retain structured data', async () => {
  const db = new PGlite()
  try {
    for (const file of (await readdir(new URL('../db/migrations/', import.meta.url))).filter(file => file.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(`../db/migrations/${file}`, import.meta.url), 'utf8'))
    const legacy = await db.query<{ id: string; platforms: string[] }>("INSERT INTO resources (title, slug, target_url) VALUES ('Old', 'old', 'https://example.com') RETURNING *")
    assert.deepEqual(legacy.rows[0]!.platforms, [])
    const values = enrichmentValues('resources', resourceSchema.parse(resource))
    await db.query(`UPDATE resources SET ${values.map((value, index) => `${value.column} = $${index + 2}`).join(', ')} WHERE id = $1`, [legacy.rows[0]!.id, ...values.map(value => value.value)])
    const rows = (await db.query('SELECT * FROM resources')).rows
    const exported = whitelistExport('resources', rows)[0]!
    assert.deepEqual(exported.downloadSources, resource.downloadSources)
    assert.deepEqual(whitelistExport('resources', rows), JSON.parse(JSON.stringify(whitelistExport('resources', rows))))
    const imported = validateImportRow('resources', csvImportRows('resources', csvExport('resources', rows))[0])
    assert.equal(imported.success, true)
    if (imported.success) assert.deepEqual((imported.data as Record<string, unknown>).downloadSources, resource.downloadSources)
    const media = mediaSchema.parse({ title: 'Movie', slug: 'movie', mediaType: 'movie', director: 'Director', publisher: 'Studio', releaseDate: '2026-11-20', channels: [{ kind: 'watch', label: 'Streaming', url: 'https://example.com/watch' }] })
    const mediaValues = enrichmentValues('media', media)
    const mediaRows = (await db.query(`INSERT INTO media_items (title, slug, media_type, ${mediaValues.map(item => item.column).join(', ')}) VALUES ('Movie', 'movie', 'movie', ${mediaValues.map((_, index) => `$${index + 1}`).join(', ')}) RETURNING *`, mediaValues.map(item => item.value))).rows
    const mediaImport = validateImportRow('media', csvImportRows('media', csvExport('media', mediaRows))[0])
    assert.equal(mediaImport.success, true)
    if (mediaImport.success) {
      assert.deepEqual((mediaImport.data as Record<string, unknown>).channels, media.channels)
      assert.equal((mediaImport.data as Record<string, unknown>).releaseDate, '2026-11-20')
    }
    await assert.rejects(db.query('UPDATE resources SET screenshots = $1::jsonb', [JSON.stringify(['https://example.com/api/assets/00000000-0000-4000-8000-000000000000'])]), /Referenced image does not exist/)
  } finally { await db.close() }
})
