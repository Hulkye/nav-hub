import assert from 'node:assert/strict'
import { test } from 'node:test'
import { navigationLimits, parseNavigation, prependNavigation } from '../shared/utils/local-navigation'
import { createSiteDetailsRepository } from '../api/server/repositories/site-details'
import type { ContentDatabase } from '../api/server/repositories/content'
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { siteSchema } from '../shared/schemas/content'
import { createContentRepository } from '../api/server/repositories/content'
import { csvExport, csvImportRows, validateImportRow, whitelistExport } from '../api/server/utils/content-transfer'
import { shareDetail } from '../shared/utils/detail-sharing'

test('local navigation validates HTTP URLs, de-duplicates and enforces per-list limits', () => {
  const entries = Array.from({ length: 60 }, (_, index) => ({ slug: `site-${index}`, title: `Site ${index}`, url: 'https://example.com' }))
  assert.equal(parseNavigation(JSON.stringify(entries), 'favorites').length, navigationLimits.favorites)
  assert.equal(prependNavigation([], entries[0]!, 'recent').length, 1)
  const recent = parseNavigation(JSON.stringify(entries), 'recent')
  const reordered = prependNavigation(recent, entries[4]!, 'recent')
  assert.equal(reordered.length, 20)
  assert.equal(reordered[0]?.slug, 'site-4')
  assert.equal(reordered.filter(item => item.slug === 'site-4').length, 1)
  assert.throws(() => parseNavigation(JSON.stringify([{ ...entries[0], url: 'javascript:alert(1)' }]), 'favorites'))
  assert.throws(() => parseNavigation(JSON.stringify([{ ...entries[0], slug: '../admin' }]), 'recent'))
  assert.throws(() => parseNavigation(JSON.stringify([{ ...entries[0], url: 'https://user:password@example.com' }]), 'favorites'))
  assert.throws(() => parseNavigation('{', 'recent'))
})

test('related sites query includes only published sites sharing a category', async () => {
  const db = new PGlite()
  try {
    for (const migration of ['0001_admin_foundation.sql', '0002_content_foundation.sql', '0003_navigation_features.sql', '0008_link_health.sql', '0018_site_details.sql', '0028_site_body.sql', '0029_link_health_latency.sql']) await db.exec(await readFile(new URL(`../db/migrations/${migration}`, import.meta.url), 'utf8'))
    const sites = await db.query<{ id: string }>(`INSERT INTO sites (title, slug, target_url, status) VALUES ('Source', 'source', 'https://example.com', 'published'), ('Related', 'related', 'https://example.com', 'published'), ('Draft', 'draft', 'https://example.com', 'draft'), ('Unrelated', 'unrelated', 'https://example.com', 'published') RETURNING id`)
    const category = await db.query<{ id: string }>("INSERT INTO categories (name, slug) VALUES ('Shared', 'shared') RETURNING id")
    for (const site of sites.rows.slice(0, 3)) await db.query('INSERT INTO site_categories (site_id, category_id) VALUES ($1, $2)', [site.id, category.rows[0]!.id])
    const repository = createSiteDetailsRepository(db as unknown as ContentDatabase)
    assert.deepEqual((await repository.relatedSites(sites.rows[0]!.id)).map(site => site.slug), ['related'])
    assert.equal((await repository.relatedSites(sites.rows[0]!.id))[0]?.target_url, 'https://example.com')
    assert.deepEqual(await repository.relatedSites(sites.rows[3]!.id), [])
    const tags = await db.query<{ id: string }>("INSERT INTO tags (name, slug) VALUES ('shared', 'shared-tag') RETURNING id")
    await db.query('INSERT INTO site_tags (site_id, tag_id) VALUES ($1, $2), ($3, $2), ($4, $2)', [sites.rows[0]!.id, tags.rows[0]!.id, sites.rows[1]!.id, sites.rows[3]!.id])
    assert.deepEqual((await repository.relatedTagSites(sites.rows[0]!.id)).map(site => site.slug), ['related', 'unrelated'])
  } finally { await db.close() }
})

test('site detail optional URLs normalize missing values and reject unsafe schemes', () => {
  const input = { title: 'Site', slug: 'site', targetUrl: 'https://example.com' }
  assert.equal(siteSchema.parse(input).backupUrl, null)
  assert.equal(siteSchema.parse({ ...input, previewUrl: 'https://example.com/preview' }).previewUrl, 'https://example.com/preview')
  assert.equal(siteSchema.safeParse({ ...input, backupUrl: 'data:text/html,invalid' }).success, false)
})

test('site backup and preview URLs persist through repository create, update, list and public read', async () => {
  const db = new PGlite()
  try {
    for (const migration of ['0001_admin_foundation.sql', '0002_content_foundation.sql', '0003_navigation_features.sql', '0004_content_operations.sql', '0008_link_health.sql', '0012_image_assets.sql', '0013_image_asset_references.sql', '0014_image_reference_guards.sql', '0017_content_enrichment.sql', '0018_site_details.sql', '0019_image_site_preview.sql', '0028_site_body.sql', '0029_link_health_latency.sql']) {
      await db.exec(await readFile(new URL(`../db/migrations/${migration}`, import.meta.url), 'utf8'))
    }
    const repository = createContentRepository({ query: (sql, parameters) => db.query(sql, parameters), transaction: callback => db.transaction(tx => callback(tx as ContentDatabase)) })
    const created = await repository.createSite({ title: 'Round trip', slug: 'round-trip', description: 'desc', targetUrl: 'https://example.com', backupUrl: 'https://backup.example.com', previewUrl: 'https://preview.example.com', iconUrl: null, status: 'published', sortOrder: 1, categoryIds: [], tagIds: [] })
    assert.equal(created?.backup_url, 'https://backup.example.com')
    assert.equal(created?.preview_url, 'https://preview.example.com')
    const exported = whitelistExport('sites', [created!])[0]!
    assert.equal(exported.backupUrl, 'https://backup.example.com')
    assert.equal(exported.previewUrl, 'https://preview.example.com')
    const imported = validateImportRow('sites', csvImportRows('sites', csvExport('sites', [created!]))[0])
    assert.equal(imported.success, true)
    if (imported.success) assert.equal('previewUrl' in imported.data && imported.data.previewUrl, 'https://preview.example.com')
    await repository.updateSite(String(created?.id), { title: 'Round trip updated', slug: 'round-trip', description: 'updated', targetUrl: 'https://example.com/new', backupUrl: null, previewUrl: 'https://preview.example.com/new', iconUrl: null, status: 'published', sortOrder: 2, categoryIds: [], tagIds: [] })
    assert.equal((await repository.listSites()).find(site => site.id === created?.id)?.preview_url, 'https://preview.example.com/new')
    assert.equal((await repository.listAdminSites()).items.find(site => site.id === created?.id)?.backup_url, null)
    assert.equal((await repository.getPublishedSite('round-trip'))?.preview_url, 'https://preview.example.com/new')
    const admin = await db.query<{ id: string }>("INSERT INTO admins (username, password_hash) VALUES ('image-owner', 'hash') RETURNING id")
    const asset = await db.query<{ id: string }>("INSERT INTO image_assets (id, object_key, filename, content_type, byte_size, width, height, uploaded_by) VALUES (gen_random_uuid(), 'preview.webp', 'preview.webp', 'image/webp', 100, 100, 100, $1) RETURNING id", [admin.rows[0]!.id])
    await db.query('UPDATE sites SET preview_url = $1 WHERE id = $2', [`https://example.com/api/assets/${asset.rows[0]!.id}`, created!.id])
    assert.equal((await db.query("SELECT field FROM image_asset_references WHERE asset_id = $1", [asset.rows[0]!.id])).rows[0]?.field, 'preview_url')
    await assert.rejects(db.query("UPDATE sites SET preview_url = 'https://example.com/api/assets/00000000-0000-4000-8000-000000000001' WHERE id = $1", [created!.id]), /Referenced image does not exist/)
    await assert.rejects(db.query("INSERT INTO resources (title, slug, resource_type, screenshots) VALUES ('Missing screenshot', 'missing-screenshot', 'software', $1::jsonb)", [JSON.stringify(['https://example.com/api/assets/00000000-0000-4000-8000-000000000001'])]), /Referenced image does not exist/)
  } finally { await db.close() }
})

test('public site signals expose aggregate stats and coarse health only for published sites', async () => {
  const db = new PGlite()
  try {
    for (const migration of ['0001_admin_foundation.sql', '0002_content_foundation.sql', '0003_navigation_features.sql', '0006_content_events.sql', '0008_link_health.sql', '0029_link_health_latency.sql']) await db.exec(await readFile(new URL(`../db/migrations/${migration}`, import.meta.url), 'utf8'))
    const source = await db.query<{ id: string }>("INSERT INTO sites (title, slug, target_url, status) VALUES ('Signals', 'signals', 'https://example.com', 'published'), ('Private', 'private-signals', 'https://private.example', 'draft') RETURNING id")
    const repository = createSiteDetailsRepository(db as unknown as ContentDatabase)
    const siteId = source.rows[0]!.id
    await db.query("INSERT INTO content_events (event_type, content_type, content_id, dedupe_key) VALUES ('view', 'site', $1, 'view-1'), ('outbound_click', 'site', $1, 'click-1')", [siteId])
    await db.query("INSERT INTO link_health_checks (content_type, content_id, result_category, elapsed_ms, checked_at) VALUES ('site', $1, 'ok', 2300, now())", [siteId])
    const signals = await repository.publicSignals(siteId)
    assert.deepEqual(signals?.stats, { views: 1, clicks: 1 })
    assert.equal(signals?.link_health?.status, 'slow')
    assert.equal(signals?.link_health?.elapsed_ms, 2300)
    assert.ok(signals?.link_health?.checked_at)
    await db.query("UPDATE link_health_checks SET result_category = 'dns_error', error_summary = 'private diagnostic' WHERE content_id = $1", [siteId])
    assert.equal((await repository.publicSignals(siteId))?.link_health?.status, 'unavailable')
    assert.equal(JSON.stringify(await repository.publicSignals(siteId)).includes('private diagnostic'), false)
    for (const category of ['pending', 'ignored']) {
      await db.query('UPDATE link_health_checks SET result_category = $2 WHERE content_id = $1', [siteId, category])
      assert.equal((await repository.publicSignals(siteId))?.link_health, null)
    }
    await db.query("UPDATE link_health_checks SET result_category = 'ok', elapsed_ms = 1200 WHERE content_id = $1", [siteId])
    assert.equal((await repository.publicSignals(siteId))?.link_health?.status, 'ok')
    assert.equal(await repository.publicSignals(source.rows[1]!.id), undefined)
  } finally { await db.close() }
})

test('detail sharing uses native share, copies on failure, and respects cancellation', async () => {
  const payload = { title: 'Site', url: 'https://example.com/sites/site' }
  const copies: string[] = []
  const copy = async (text: string) => { copies.push(text) }
  assert.equal(await shareDetail(payload, { copy }), 'copied')
  assert.equal(await shareDetail(payload, { copy, share: async () => {} }), 'shared')
  assert.equal(await shareDetail(payload, { copy, share: async () => { throw new Error('Unavailable') } }), 'copied')
  assert.equal(await shareDetail(payload, { copy, share: async () => { throw Object.assign(new Error('Cancelled'), { name: 'AbortError' }) } }), 'cancelled')
  assert.deepEqual(copies, [payload.url, payload.url])
})
