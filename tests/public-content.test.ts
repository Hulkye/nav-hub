import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { commentSchema, httpUrlSchema, siteSchema, submissionSchema } from '../shared/schemas/content'
import { createContentRepository } from '../api/server/repositories/content'
import { resolvePublicClientIp } from '../api/server/utils/public-client-ip'
import { renderRss } from '../api/server/utils/rss'
import { createSearchDiscoveryRepository } from '../api/server/repositories/search-discovery'
import { addSearchHistory, isSearchTypo, readSearchHistory, searchHistoryKey, searchAlternatives } from '../shared/utils/search-discovery'

test('search history is bounded, normalized and tolerant of corrupt browser storage', () => {
  assert.equal(searchHistoryKey, 'navhub.search.history.v1')
  assert.deepEqual(readSearchHistory('{'), [])
  assert.deepEqual(addSearchHistory([' JavaScript ', 'typescript'], 'javascript'), ['javascript', 'typescript'])
  assert.equal(readSearchHistory(JSON.stringify(Array.from({ length: 20 }, (_, i) => `term ${i}`))).length, 10)
  assert.equal(isSearchTypo('javascrpt', 'javascript'), true)
  assert.equal(isSearchTypo('ab', 'ac'), false)
  assert.deepEqual(searchAlternatives('js', []), ['javascript'])
})

test('discovery aggregates only published catalog terms and searches bounded typo alternatives', async () => {
  const db = new PGlite()
  try {
    for (const migration of ['0002_content_foundation', '0003_navigation_features', '0004_content_operations', '0022_search_discovery', '0030_search_analytics']) await db.exec(await readFile(new URL(`../db/migrations/${migration}.sql`, import.meta.url), 'utf8'))
    const repository = createSearchDiscoveryRepository(db)
    await db.query("INSERT INTO sites (title, slug, target_url, description, status) VALUES ('JavaScript Guide', 'js-guide', 'https://example.com', 'Learn JavaScript', 'published'), ('Private JavaScript', 'private-js', 'https://private.example', 'Learn JavaScript', 'draft')")
    await db.query("INSERT INTO search_discovery_terms (slot, term, searches) VALUES (1, 'javascript guide', 4), (2, 'secret search', 50)")
    const result = await repository.discover({ q: 'javascrpt', type: 'all' })
    assert.deepEqual(result.popular, ['JavaScript Guide'])
    assert.ok(result.suggestions.includes('javascript'))
    assert.ok(result.suggestions.includes('JavaScript Guide'))
    assert.equal(result.results[0]?.title, 'JavaScript Guide')
    assert.ok(result.recommendations.every(item => item.title !== 'Private JavaScript'))
    assert.equal((await repository.search({ q: 'javascrpt', type: 'site', page: 2, pageSize: 1 })).page, 2)
    await repository.record({ q: 'private javascript', type: 'all', resultCount: 0 })
    assert.equal((await db.query("SELECT zero_results FROM search_analytics WHERE term = 'private javascript'")).rows[0]!.zero_results, 1)
    await repository.recordClick({ q: 'private javascript', type: 'all', contentType: 'site' })
    assert.equal((await db.query("SELECT clicks FROM search_analytics WHERE term = 'private javascript'")).rows[0]!.clicks, 1)
    const analytics = await createContentRepository(db).getSearchAnalytics()
    assert.equal(analytics.conversion_rate, 1)
  } finally { await db.close() }
})

test('public search validates filters, escapes LIKE wildcards and pages in deterministic order', async () => {
  const db = new PGlite()
  try {
    await db.exec(await readFile(new URL('../db/migrations/0002_content_foundation.sql', import.meta.url), 'utf8'))
    await db.exec(await readFile(new URL('../db/migrations/0003_navigation_features.sql', import.meta.url), 'utf8'))
    await db.exec(await readFile(new URL('../db/migrations/0004_content_operations.sql', import.meta.url), 'utf8'))
    await db.exec(await readFile(new URL('../db/migrations/0027_site_category_order.sql', import.meta.url), 'utf8'))
    await db.exec(await readFile(new URL('../db/migrations/0006_content_events.sql', import.meta.url), 'utf8'))
    const repository = createContentRepository(db)
    await db.query("INSERT INTO sites (title, slug, target_url, description, status) VALUES ('Alpha', 'alpha', 'https://alpha.example', 'Needle', 'published'), ('Beta', 'beta', 'https://beta.example', 'Needle', 'published'), ('Private', 'private', 'https://private.example', 'Needle', 'draft')")
    await db.query("INSERT INTO resources (title, slug, description, target_url, status) VALUES ('Gamma', 'gamma', 'Needle', 'https://gamma.example', 'published')")
    const page = await repository.search('Needle', { type: 'all', page: 2, pageSize: 1 })
    assert.equal(page.total, 3)
    assert.equal(page.results.length, 1)
    assert.equal(page.results[0]!.title, 'Beta')
    const sites = await repository.search('Needle', { type: 'site', pageSize: 50 })
    assert.equal(sites.total, 2)
    assert.ok(sites.results.every(row => row.type === 'site'))
    assert.equal((await repository.search('Needle', { type: 'site', page: 3, pageSize: 1 })).results.length, 0)
    assert.equal((await repository.search('anything', { type: 'all' })).total, 0)
    await assert.rejects(repository.search('Needle', { type: 'bogus' }), /Invalid option/)
    assert.equal((await repository.search('%', { type: 'all' })).total, 0)
    assert.equal((await repository.search('Needle', { type: 'all', category: 'missing-category' })).total, 0)
    assert.equal((await repository.search('Needle', { type: 'all', sort: 'latest' })).total, 3)
    assert.equal((await repository.search('Needle', { type: 'all', sort: 'popular' })).total, 3)
  } finally { await db.close() }
})

const site = { contentType: 'site' as const, payload: { title: ' Example ', targetUrl: 'https://example.com/path' } }

test('RSS escapes XML, preserves unicode, and uses canonical detail links', () => {
  const xml = renderRss('https://nav.example', [{ content_type: 'article', slug: 'example', title: 'A & B <title> 😀', summary: '<script>text</script>\u0000', published_at: '2026-11-01T12:00:00Z' }])
  assert.match(xml, /A &amp; B &lt;title&gt; 😀/)
  assert.match(xml, /&lt;script&gt;text&lt;\/script&gt;/)
  assert.equal(xml.includes('\u0000'), false)
  assert.match(xml, /<guid isPermaLink="true">https:\/\/nav.example\/articles\/example<\/guid>/)
  assert.match(xml, /Sun, 01 Nov 2026 12:00:00 GMT/)
  assert.match(renderRss('https://nav.example', []), /<channel>/)
  assert.throws(() => renderRss('javascript:alert(1)', []), /INVALID_SITE_URL/)
})

test('RSS combines public collections, orders by publication date and enforces its limit', async () => {
  const db = new PGlite()
  try {
    for (const migration of ['0001_admin_foundation', '0002_content_foundation', '0003_navigation_features']) await db.exec(await readFile(new URL(`../db/migrations/${migration}.sql`, import.meta.url), 'utf8'))
    const repository = createContentRepository(db)
    await db.query("INSERT INTO sites (title, slug, target_url, status, published_at) VALUES ('Site', 'site', 'https://example.com', 'published', '2026-11-01')")
    for (const table of ['resources', 'media_items', 'articles']) {
      await db.query(`INSERT INTO ${table} (title, slug, status, published_at) VALUES ('Published', '${table}', 'published', '2026-11-02'), ('Private', 'private', 'draft', '2026-11-03'), ('Offline', 'offline', 'offline', '2026-11-04')`)
    }
    const items = await repository.listRssItems()
    assert.equal(items.length, 4)
    assert.equal(items.at(-1)!.content_type, 'site')
    assert.deepEqual(new Set(items.map(item => item.content_type)), new Set(['site', 'resource', 'media', 'article']))
    assert.equal((await repository.listRssItems(2)).length, 2)
    await assert.rejects(repository.listRssItems(101), /INVALID_RSS_LIMIT/)
    assert.equal(JSON.stringify(items).includes('Private'), false)
  } finally { await db.close() }
})

test('submissions use strict per-type payload schemas and bounded fields', () => {
  assert.equal(submissionSchema.parse(site).payload.title, 'Example')
  const valid = [site,
    { contentType: 'resource', payload: { title: 'Tool', targetUrl: 'https://example.com' } },
    { contentType: 'media', payload: { title: 'Book', mediaType: 'book' } },
    { contentType: 'article', payload: { title: 'Article', body: 'Article text' } }
  ]
  for (const input of valid) assert.equal(submissionSchema.safeParse(input).success, true)
  const invalid = [
    { contentType: 'other', payload: site.payload },
    { ...site, payload: {} },
    { ...site, payload: { ...site.payload, status: 'published' } },
    { ...site, payload: { ...site.payload, arbitrary: { nested: true } } },
    { ...site, payload: { ...site.payload, title: ' ' } },
    { ...site, payload: { ...site.payload, description: 'x'.repeat(2001) } },
    { ...site, payload: { ...site.payload, slug: '../../path' } },
    { contentType: 'resource', payload: { title: 'Tool' } },
    { contentType: 'media', payload: { title: 'Book', mediaType: 'invalid' } },
    { contentType: 'media', payload: { title: 'Book', rating: 11 } },
    { contentType: 'article', payload: { title: 'Article', body: '' } },
    { ...site, contactEmail: 'bad-email' }
  ]
  for (const input of invalid) assert.equal(submissionSchema.safeParse(input).success, false, JSON.stringify(input))
})

test('all link and image fields reject executable protocols and credentials', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'ftp://example.com', '//example.com', 'https://user:secret@example.com', 'https://example.com/a\nb', 'https://example.com/' + 'x'.repeat(2048)]) {
    assert.equal(httpUrlSchema.safeParse(url).success, false, url)
    assert.equal(submissionSchema.safeParse({ ...site, payload: { ...site.payload, targetUrl: url } }).success, false)
    assert.equal(submissionSchema.safeParse({ ...site, payload: { ...site.payload, iconUrl: url } }).success, false)
    assert.equal(submissionSchema.safeParse({ contentType: 'media', payload: { title: 'Book', coverUrl: url } }).success, false)
    assert.equal(siteSchema.safeParse({ title: 'Admin site', slug: 'admin-site', targetUrl: 'https://example.com', iconUrl: url }).success, false)
  }
  assert.equal(httpUrlSchema.safeParse('https://example.com/path?q=value#part').success, true)
})

test('client IP defaults to socket and trusts only configured proxy hops', () => {
  assert.equal(resolvePublicClientIp('203.0.113.5', '1.1.1.1'), '203.0.113.5')
  assert.equal(resolvePublicClientIp('203.0.113.5', '2.2.2.2', '127.0.0.1'), '203.0.113.5')
  assert.equal(resolvePublicClientIp('127.0.0.1', '198.51.100.7', '127.0.0.1'), '198.51.100.7')
  assert.equal(resolvePublicClientIp('127.0.0.1', '1.1.1.1, 198.51.100.7', '127.0.0.1'), '198.51.100.7')
  assert.equal(resolvePublicClientIp('127.0.0.1', '1.1.1.1, 10.0.0.2', '127.0.0.1,10.0.0.2'), '1.1.1.1')
  assert.equal(resolvePublicClientIp('::ffff:127.0.0.1', '198.51.100.7', '127.0.0.1'), '198.51.100.7')
  assert.equal(resolvePublicClientIp('2001:0db8::1', '198.51.100.7', '2001:db8::1'), '198.51.100.7')
  assert.equal(resolvePublicClientIp('127.0.0.1', 'invalid, 198.51.100.7', '127.0.0.1'), '127.0.0.1')
  assert.equal(resolvePublicClientIp(undefined, '198.51.100.7', '127.0.0.1'), 'unknown')
})

test('database rejects cross-type/unpublished comment targets and limits spoofed clients', async () => {
  const db = new PGlite()
  try {
    for (const migration of ['0001_admin_foundation', '0002_content_foundation', '0003_navigation_features', '0004_content_operations', '0005_homepage_modules', '0006_content_events']) {
      await db.exec(await readFile(new URL(`../db/migrations/${migration}.sql`, import.meta.url), 'utf8'))
    }
    const repository = createContentRepository(db)
    const input = { contentType: 'site' as const, contentId: '00000000-0000-4000-8000-000000000001', displayName: 'Reader', body: 'A useful comment' }
    for (const [type, table] of Object.entries({ site: 'sites', resource: 'resources', media: 'media_items', article: 'articles' })) {
      const columns = type === 'site' ? ', target_url' : ''
      const values = type === 'site' ? ", 'https://example.com'" : ''
      const result = await db.query<{ id: string }>(`INSERT INTO ${table} (title, slug, status${columns}) VALUES ('Target', '${type}', 'published'${values}) RETURNING id`)
      const contentId = result.rows[0]!.id
      assert.ok(await repository.createComment({ ...input, contentType: type as typeof input.contentType, contentId }))
      for (const otherType of ['site', 'resource', 'media', 'article'] as const) {
        if (otherType !== type) await assert.rejects(repository.createComment({ ...input, contentType: otherType, contentId }), /COMMENT_TARGET_NOT_FOUND/)
      }
      for (const status of ['draft', 'offline']) {
        await db.query(`UPDATE ${table} SET status = $1 WHERE id = $2`, [status, contentId])
        await assert.rejects(repository.createComment({ ...input, contentType: type as typeof input.contentType, contentId }), /COMMENT_TARGET_NOT_FOUND/)
      }
    }
    await assert.rejects(repository.createComment(input), /COMMENT_TARGET_NOT_FOUND/)
    assert.equal(commentSchema.safeParse({ ...input, contentType: 'unknown' }).success, false)
    assert.equal((await db.query('SELECT * FROM comments')).rows.length, 4)
    await repository.createSubmission(submissionSchema.parse(site))
    assert.equal((await db.query('SELECT status FROM guest_submissions')).rows[0]!.status, 'pending')
    for (let attempt = 0; attempt < 5; attempt++) {
      const ip = resolvePublicClientIp('203.0.113.5', `198.51.100.${attempt}`)
      assert.equal(await repository.consumePublicLimit(`comment:${ip}`), true)
    }
    assert.equal(await repository.consumePublicLimit('comment:203.0.113.5'), false)
    assert.equal(await repository.consumePublicLimit('submission:203.0.113.5'), true)
    await db.query("UPDATE login_limits SET expires_at = now() - interval '1 minute'")
    assert.equal(await repository.consumePublicLimit('comment:203.0.113.5'), true)
  } finally { await db.close() }
})

test('public event deduplication, outbound publication gate and privacy-safe aggregation', async () => {
  const db = new PGlite()
  try {
    for (const migration of ['0001_admin_foundation', '0002_content_foundation', '0003_navigation_features', '0004_content_operations', '0005_homepage_modules', '0006_content_events']) await db.exec(await readFile(new URL(`../db/migrations/${migration}.sql`, import.meta.url), 'utf8'))
    const repository = createContentRepository(db)
    const published = await db.query<{ id: string }>("INSERT INTO sites (title, slug, target_url, status) VALUES ('Tracked site', 'tracked', 'https://example.com/path', 'published') RETURNING id")
    const draft = await db.query<{ id: string }>("INSERT INTO sites (title, slug, target_url, status) VALUES ('Private site', 'private', 'https://private.example', 'draft') RETURNING id")
    const siteId = published.rows[0]!.id
    const start = new Date(Date.now() - 60_000)
    const end = new Date(Date.now() + 60_000)
    await repository.recordPublicEvent('view', 'site', siteId, 'hashed-window-key')
    await repository.recordPublicEvent('view', 'site', siteId, 'hashed-window-key')
    await repository.recordPublicEvent('outbound_click', 'site', siteId, 'another-hashed-window-key')
    assert.equal((await repository.getOutboundTarget(siteId))?.target_url, 'https://example.com/path')
    assert.equal(await repository.getOutboundTarget(draft.rows[0]!.id), undefined)
    const stats = await repository.getEventStats(start, end)
    assert.equal(stats.totals.find(item => item.event_type === 'view')?.count, 1)
    assert.equal(stats.totals.find(item => item.event_type === 'outbound_click')?.count, 1)
    assert.equal((stats.items[0] as { title: string }).title, 'Tracked site')
    assert.equal(JSON.stringify(stats).includes('hashed-window-key'), false)
  } finally { await db.close() }
})
