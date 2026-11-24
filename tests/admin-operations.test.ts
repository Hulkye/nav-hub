import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { createContentRepository, type ContentDatabase } from '../api/server/repositories/content'
import { checkLinkHealth } from '../api/server/utils/link-health'
import { csvCell, csvExport, csvImportRows, importTemplate, parseCsv, validateImportRow, whitelistExport } from '../api/server/utils/content-transfer'
import { reportSchema } from '../shared/schemas/content'

async function setup() {
  const db = new PGlite()
  for (const migration of (await readdir(new URL('../db/migrations/', import.meta.url))).filter(file => file.endsWith('.sql')).sort()) {
    await db.exec(await readFile(new URL(`../db/migrations/${migration}`, import.meta.url), 'utf8'))
  }
  const admin = await db.query<{ id: string }>("INSERT INTO admins (username, password_hash) VALUES ('operator', 'hash') RETURNING id")
  const repository = createContentRepository({ query: (sql, parameters) => db.query(sql, parameters), transaction: callback => db.transaction(tx => callback(tx as ContentDatabase)) })
  return { db, repository, adminId: admin.rows[0]!.id }
}

test('content tag associations persist atomically across every admin collection', async () => {
  const { db, repository } = await setup()
  try {
    const tag = await repository.createTag({ name: 'Useful', slug: 'useful', description: '' })
    const samples = {
      resources: { title: 'Resource', slug: 'resource', targetUrl: 'https://resource.example', tagIds: [tag!.id] },
      media: { title: 'Media', slug: 'media', tagIds: [tag!.id] },
      articles: { title: 'Article', slug: 'article', body: 'Body', tagIds: [tag!.id] },
      announcements: { title: 'Notice', body: 'Body', tagIds: [tag!.id] }
    }
    for (const [collection, input] of Object.entries(samples) as Array<[keyof typeof samples, (typeof samples)[keyof typeof samples]]>) {
      const created = await repository.createAdminContent(collection, input)
      assert.deepEqual(created!.tag_ids, [tag!.id])
      assert.deepEqual((await repository.getAdminContent(collection, String(created!.id)))!.tag_ids, [tag!.id])
      await repository.updateAdminContent(collection, String(created!.id), { ...input, tagIds: [] })
      assert.deepEqual((await repository.getAdminContent(collection, String(created!.id)))!.tag_ids, [])
    }
    const invalidTag = '00000000-0000-4000-8000-000000000111'
    await assert.rejects(repository.createAdminContent('resources', { ...samples.resources, slug: 'rollback-resource', tagIds: [invalidTag] }))
    assert.equal((await db.query("SELECT id FROM resources WHERE slug = 'rollback-resource'")).rows.length, 0)
  } finally { await db.close() }
})

test('reports accept only published targets and keep processing atomic and private', async () => {
  const { db, repository, adminId } = await setup()
  try {
    const published = await db.query<{ id: string }>("INSERT INTO sites (title, slug, target_url, status) VALUES ('Report target', 'report-target', 'https://example.com', 'published') RETURNING id")
    const draft = await db.query<{ id: string }>("INSERT INTO sites (title, slug, target_url) VALUES ('Draft', 'report-draft', 'https://draft.example') RETURNING id")
    const input = reportSchema.parse({ contentType: 'site', contentId: published.rows[0]!.id, reason: 'broken_link', details: 'Link no longer loads', contactEmail: 'private@example.com' })
    assert.equal(reportSchema.safeParse({ ...input, reason: 'invalid' }).success, false)
    assert.equal(reportSchema.safeParse({ ...input, details: 'x'.repeat(2001) }).success, false)
    assert.equal(reportSchema.safeParse({ ...input, contentId: 'invalid' }).success, false)
    await assert.rejects(repository.createReport({ ...input, contentId: draft.rows[0]!.id }, 'client-hash'), /REPORT_TARGET_NOT_FOUND/)
    await assert.rejects(repository.createReport({ ...input, contentType: 'resource' }, 'client-hash'), /REPORT_TARGET_NOT_FOUND/)
    const created = await repository.createReport(input, 'client-hash')
    const pending = await repository.listReports({ status: 'pending', page: 1, pageSize: 1 })
    assert.equal(pending.total, 1)
    assert.equal(pending.items[0]!.content_title, 'Report target')
    assert.equal('client_hash' in pending.items[0]!, false)
    assert.equal('contact_email' in pending.items[0]!, false)
    const id = String(created!.id)
    const reviews = await Promise.all([repository.reviewReport(id, 'reviewed', adminId, 'Fixed'), repository.reviewReport(id, 'dismissed', adminId)])
    assert.equal(reviews.filter(Boolean).length, 1)
    assert.equal((await repository.listReports({ status: 'pending' })).total, 0)
    assert.equal((await db.query("SELECT count(*)::int AS count FROM admin_audit_logs WHERE resource = 'content_report'")).rows[0]!.count, 1)
    for (let index = 0; index < 5; index++) assert.equal(await repository.consumePublicLimit('report:test'), true)
    assert.equal(await repository.consumePublicLimit('report:test'), false)
  } finally { await db.close() }
})

test('content transfer whitelists fields, neutralizes CSV formulas and forces imported drafts', async () => {
  const exported = whitelistExport('resources', [{ id: 'private-id', title: '=1+1', slug: 'example', target_url: 'https://example.com', status: 'published', tag_ids: ['tag-id'], contact_email: 'private@example.com', password_hash: 'secret' }])
  assert.deepEqual(exported[0], { title: '=1+1', slug: 'example', targetUrl: 'https://example.com', tagIds: ['tag-id'], status: 'published' })
  assert.equal(csvCell('=1+1'), "\"'=1+1\"")
  assert.match(csvExport('resources', [{ title: '+cmd', slug: 'safe' }]), /"'\+cmd"/)
  const imported = validateImportRow('resources', { title: 'Imported', slug: 'imported', description: '', targetUrl: 'https://imported.example', status: 'published' })
  assert.equal(imported.success, true)
  if (imported.success) assert.equal(imported.data.status, 'draft')
  assert.equal(validateImportRow('resources', { title: 'Bad', slug: 'bad', targetUrl: 'javascript:alert(1)' }).success, false)
  assert.deepEqual(parseCsv('title,body\r\n"Quoted, title","line 1\nline 2"').rows, [['Quoted, title', 'line 1\nline 2']])
  assert.deepEqual(csvImportRows('resources', 'title,slug,target_url\nTool,tool,https://tool.example'), [{ title: 'Tool', slug: 'tool', targetUrl: 'https://tool.example' }])
  assert.throws(() => csvImportRows('resources', 'title,contact_email\nTitle,email@example.com'), /CSV_UNKNOWN_FIELD/)
})

test('batch imports report invalid and duplicate rows and audit successful drafts', async () => {
  const { db, repository, adminId } = await setup()
  try {
    const input = [
      { rowNumber: 1, data: { title: 'One', slug: 'batch-one', description: '', targetUrl: 'https://one.example', status: 'draft', tagIds: [] } },
      { rowNumber: 2, data: { title: 'Duplicate', slug: 'batch-one', description: '', targetUrl: 'https://two.example', status: 'draft', tagIds: [] } },
      { rowNumber: 3, data: { title: 'Existing', slug: 'existing', description: '', targetUrl: 'https://existing.example', status: 'draft', tagIds: [] } }
    ]
    await repository.createAdminContent('resources', input[2]!.data)
    const result = await repository.importAdminContent('resources', input, adminId)
    assert.equal(result.imported, 1)
    assert.equal(result.rejected, 2)
    assert.equal((await db.query("SELECT status FROM resources WHERE slug = 'batch-one'")).rows[0]!.status, 'draft')
    assert.equal((await db.query('SELECT count(*)::int AS count FROM content_import_batches')).rows[0]!.count, 1)
    assert.equal((await db.query("SELECT count(*)::int AS count FROM admin_audit_logs WHERE action = 'import'")).rows[0]!.count, 1)
    const history = await repository.listImportBatches('resources')
    assert.equal(history[0]!.id, result.batchId)
    assert.deepEqual(history[0]!.row_results, result.rows)
    const repeated = await repository.importAdminContent('resources', input, adminId)
    assert.equal(repeated.imported, 0)
    assert.equal(repeated.rejected, 3)
  } finally { await db.close() }
})

test('CSV templates and exports preserve typed fields, accept over 100 rows and reject malformed input', () => {
  const tag = '00000000-0000-4000-8000-000000000111'
  for (const collection of ['sites', 'resources', 'media', 'articles', 'announcements'] as const) {
    assert.equal(validateImportRow(collection, importTemplate(collection)).success, true)
    const sample = { ...importTemplate(collection), tagIds: [tag], ...(collection === 'sites' ? { categoryIds: [tag], iconUrl: null } : {}) }
    const databaseRow = Object.fromEntries(Object.entries(sample).map(([key, value]) => [key.replace(/[A-Z]/g, char => `_${char.toLowerCase()}`), value]))
    const imported = csvImportRows(collection, `\uFEFF${csvExport(collection, [databaseRow])}`)
    const result = validateImportRow(collection, imported[0])
    assert.equal(result.success, true, JSON.stringify(result))
    if (result.success) assert.deepEqual(result.data.tagIds, [tag])
  }
  assert.throws(() => parseCsv('title\n"closed"garbage'), /CSV_INVALID_QUOTE/)
  assert.equal(parseCsv(`title\n${Array.from({ length: 101 }, () => 'row').join('\n')}`).rows.length, 101)
  const largeCsv = `title,body\n${Array.from({ length: 30 }, () => `row,${'x'.repeat(40000)}`).join('\n')}`
  assert.equal(Buffer.byteLength(largeCsv) > 1024 * 1024, true)
  assert.equal(parseCsv(largeCsv).rows.length, 30)
})

test('imports persist validation reports and reject URL conflicts without losing valid rows', async () => {
  const { db, repository, adminId } = await setup()
  try {
    const rows = [
      { rowNumber: 1, data: { ...importTemplate('resources'), slug: 'first', targetUrl: 'https://shared.example/' } },
      { rowNumber: 2, data: { ...importTemplate('resources'), slug: 'second', targetUrl: 'https://shared.example/' } },
      { rowNumber: 3, data: { ...importTemplate('resources'), slug: 'third', targetUrl: 'https://third.example/', tagIds: ['00000000-0000-4000-8000-000000000111'] } }
    ]
    const invalid = [{ rowNumber: 4, status: 'rejected' as const, errors: ['title: 必填'] }]
    const result = await repository.importAdminContent('resources', rows, adminId, 4, 1, invalid)
    assert.equal(result.imported, 1)
    assert.equal(result.rejected, 3)
    const batches = await repository.listImportBatches('resources')
    const report = batches[0]!.row_results as Array<{ rowNumber: number; errors?: string[] }>
    assert.equal(report.length, 4)
    assert.deepEqual(report[3], invalid[0])
    assert.equal((await repository.listImportBatches('sites')).length, 0)
    const largeImport = Array.from({ length: 101 }, (_, index) => ({
      rowNumber: index + 1,
      data: { title: `Import ${index}`, slug: `import-${index}`, targetUrl: `https://import-${index}.example` }
    }))
    const largerResult = await repository.importAdminContent('resources', largeImport, adminId)
    assert.equal(largerResult.total, 101)
    assert.equal(largerResult.imported, 101)
  } finally { await db.close() }
})

test('exports refuse oversized collections instead of silently truncating', async () => {
  const { db, repository } = await setup()
  try {
    await db.query("INSERT INTO sites (title, slug, target_url) SELECT 'Site', 'site-' || i, 'https://example.com/' || i FROM generate_series(1, 1001) AS i")
    await assert.rejects(repository.exportAdminContent('sites'), /EXPORT_LIMIT_EXCEEDED/)
    await db.query("DELETE FROM sites WHERE slug = 'site-1001'")
    assert.equal((await repository.exportAdminContent('sites')).length, 1000)
  } finally { await db.close() }
})

test('site imports validate and persist category and tag associations in draft', async () => {
  const { db, repository, adminId } = await setup()
  try {
    const category = await repository.createCategory({ name: 'Category', slug: 'category-import', description: '', parentId: null, sortOrder: 0 })
    const tag = await repository.createTag({ name: 'Tag', slug: 'tag-import', description: '' })
    const result = await repository.importAdminContent('sites', [{ rowNumber: 1, data: { title: 'Imported Site', slug: 'imported-site', description: '', targetUrl: 'https://site-import.example', status: 'published', sortOrder: 5, categoryIds: [category!.id], tagIds: [tag!.id] } }], adminId)
    assert.equal(result.imported, 1)
    const site = await db.query<{ id: string; status: string }>("SELECT id, status FROM sites WHERE slug = 'imported-site'")
    assert.equal(site.rows[0]!.status, 'draft')
    assert.equal((await db.query('SELECT count(*)::int AS count FROM site_categories WHERE site_id = $1 AND category_id = $2', [site.rows[0]!.id, category!.id])).rows[0]!.count, 1)
    assert.equal((await db.query('SELECT count(*)::int AS count FROM site_tags WHERE site_id = $1 AND tag_id = $2', [site.rows[0]!.id, tag!.id])).rows[0]!.count, 1)
  } finally { await db.close() }
})

test('bulk site taxonomy replaces category and tag associations atomically and audits every site', async () => {
  const { db, repository, adminId } = await setup()
  try {
    const firstCategory = await repository.createCategory({ name: 'First', slug: 'first-category', description: '', parentId: null, sortOrder: 0 })
    const nextCategory = await repository.createCategory({ name: 'Next', slug: 'next-category', description: '', parentId: null, sortOrder: 1 })
    const firstTag = await repository.createTag({ name: 'First', slug: 'first-tag', description: '' })
    const nextTag = await repository.createTag({ name: 'Next', slug: 'next-tag', description: '' })
    const site = await repository.createSite({ title: 'Bulk site', slug: 'bulk-site', description: '', body: '', targetUrl: 'https://bulk.example', iconUrl: null, status: 'draft', sortOrder: 0, categoryIds: [String(firstCategory!.id)], tagIds: [String(firstTag!.id)] })
    await repository.bulkUpdateSiteTaxonomy([String(site!.id)], [String(nextCategory!.id)], [String(nextTag!.id)], adminId)
    assert.equal((await db.query('SELECT count(*)::int AS count FROM site_categories WHERE site_id = $1 AND category_id = $2', [site!.id, nextCategory!.id])).rows[0]!.count, 1)
    assert.equal((await db.query('SELECT count(*)::int AS count FROM site_categories WHERE site_id = $1 AND category_id = $2', [site!.id, firstCategory!.id])).rows[0]!.count, 0)
    assert.equal((await db.query('SELECT count(*)::int AS count FROM site_tags WHERE site_id = $1 AND tag_id = $2', [site!.id, nextTag!.id])).rows[0]!.count, 1)
    assert.equal((await db.query("SELECT count(*)::int AS count FROM admin_audit_logs WHERE action = 'bulk_taxonomy' AND resource_id = $1", [site!.id])).rows[0]!.count, 1)
    await assert.rejects(repository.bulkUpdateSiteTaxonomy([String(site!.id)], ['00000000-0000-4000-8000-000000000111'], [], adminId))
    assert.equal((await db.query('SELECT count(*)::int AS count FROM site_categories WHERE site_id = $1 AND category_id = $2', [site!.id, nextCategory!.id])).rows[0]!.count, 1)
  } finally { await db.close() }
})

test('domain replacement only changes exact hostnames in site URL fields', async () => {
  const { db, repository, adminId } = await setup()
  try {
    const site = await repository.createSite({ title: 'Domain', slug: 'domain', description: 'old.example stays in text', body: '', targetUrl: 'https://old.example/path?q=old.example', backupUrl: 'http://old.example/backup', previewUrl: 'https://sub.old.example/image', iconUrl: null, status: 'published', sortOrder: 0, categoryIds: [], tagIds: [] })
    await repository.replaceSiteDomains([String(site!.id)], 'old.example', 'new.example', adminId)
    const updated = await repository.getAdminSite(String(site!.id))
    assert.equal(updated!.target_url, 'https://new.example/path?q=old.example')
    assert.equal(updated!.backup_url, 'http://new.example/backup')
    assert.equal(updated!.preview_url, 'https://sub.old.example/image')
    assert.equal(updated!.description, 'old.example stays in text')
    assert.equal((await db.query("SELECT count(*)::int AS count FROM admin_audit_logs WHERE action = 'replace_domain' AND resource_id = $1", [site!.id])).rows[0]!.count, 1)
  } finally { await db.close() }
})

test('site exports apply status, category and keyword filters', async () => {
  const { db, repository } = await setup()
  try {
    const category = await repository.createCategory({ name: 'Export category', slug: 'export-category', description: '', parentId: null, sortOrder: 0 })
    await repository.createSite({ title: 'Filtered site', slug: 'filtered-site', description: '', body: '', targetUrl: 'https://filtered.example', iconUrl: null, status: 'published', sortOrder: 0, categoryIds: [String(category!.id)], tagIds: [] })
    await repository.createSite({ title: 'Other site', slug: 'other-site', description: '', body: '', targetUrl: 'https://other.example', iconUrl: null, status: 'draft', sortOrder: 0, categoryIds: [], tagIds: [] })
    const filtered = await repository.exportAdminContent('sites', { q: 'Filtered', status: 'published', categoryId: String(category!.id) })
    assert.equal(filtered.length, 1)
    assert.equal(filtered[0]!.slug, 'filtered-site')
  } finally { await db.close() }
})

test('bulk status operations are capped, transactional and audited per changed item', async () => {
  const { db, repository, adminId } = await setup()
  try {
    const ids: string[] = []
    for (let index = 0; index < 3; index++) {
      const created = await repository.createAdminContent('resources', { title: `Resource ${index}`, slug: `resource-${index}`, targetUrl: 'https://resource.example' })
      ids.push(String(created!.id))
    }
    const changed = await repository.bulkUpdateAdminContent('resources', ids, 'published', adminId)
    assert.equal(changed.length, 3)
    assert.equal((await db.query("SELECT count(*)::int AS count FROM resources WHERE status = 'published'")).rows[0]!.count, 3)
    assert.equal((await db.query("SELECT count(*)::int AS count FROM admin_audit_logs WHERE action = 'bulk_status_published'")).rows[0]!.count, 3)
    await assert.rejects(repository.bulkUpdateAdminContent('resources', Array.from({ length: 101 }, (_, i) => ids[i % ids.length]!), 'offline', adminId), /INVALID_BULK_SIZE/)
    await db.query("INSERT INTO announcements (title, body, status) VALUES ('Notice', 'Body', 'draft')")
    const announcement = await db.query<{ id: string }>("SELECT id FROM announcements WHERE title = 'Notice'")
    const announcementIds = await repository.bulkUpdateAdminContent('announcements', [announcement.rows[0]!.id], 'published', adminId)
    assert.equal(announcementIds.length, 1)
    assert.equal((await db.query("SELECT status FROM announcements WHERE id = $1", [announcement.rows[0]!.id])).rows[0]!.status, 'published')
  } finally { await db.close() }
})

test('homepage modules replace atomically and only render published content', async () => {
  const { db, repository, adminId } = await setup()
  try {
    const category = await repository.createCategory({ name: 'Tools', slug: 'tools', description: '', parentId: null, sortOrder: 0 })
    const published = await repository.createSite({ title: 'Published', slug: 'published', description: '', targetUrl: 'https://published.example', iconUrl: null, status: 'published', sortOrder: 0, categoryIds: [String(category!.id)], tagIds: [] })
    const draft = await repository.createSite({ title: 'Draft', slug: 'draft', description: '', targetUrl: 'https://draft.example', iconUrl: null, status: 'draft', sortOrder: 1, categoryIds: [String(category!.id)], tagIds: [] })
    await repository.replaceHomepageModules([
      { moduleType: 'category', title: 'Tools', enabled: true, sortOrder: 0, itemLimit: 12, categoryId: String(category!.id), contentIds: [] },
      { moduleType: 'featured', title: '精选', enabled: true, sortOrder: 1, itemLimit: 12, categoryId: null, contentIds: [String(draft!.id), String(published!.id)] }
    ], adminId)
    const rendered = await repository.renderHomepageModules()
    assert.equal(rendered.length, 2)
    assert.deepEqual((rendered[0]!.items as Array<{ id: string }>).map(item => item.id), [published!.id])
    assert.deepEqual((rendered[1]!.items as Array<{ id: string }>).map(item => item.id), [published!.id])
    assert.equal((await db.query("SELECT count(*)::int AS count FROM admin_audit_logs WHERE resource = 'homepage_modules'")).rows[0]!.count, 1)
  } finally { await db.close() }
})

test('link health validates public addresses on every redirect and limits redirects', async () => {
  const resolved: string[] = []
  const result = await checkLinkHealth('https://public.example/start', {
    resolve: async hostname => { resolved.push(hostname); return { address: hostname === 'public.example' ? '93.184.216.34' : '8.8.8.8', family: 4 } },
    request: async url => url.pathname === '/start' ? { statusCode: 302, location: 'https://next.example/end' } : { statusCode: 204 }
  })
  assert.equal(result.category, 'ok')
  assert.ok(result.elapsedMs >= 0)
  assert.deepEqual(resolved, ['public.example', 'next.example'])
  const blocked = await checkLinkHealth('https://public.example/start', {
    resolve: async () => ({ address: '127.0.0.1', family: 4 }),
    request: async () => ({ statusCode: 200 })
  })
  assert.equal(blocked.category, 'unsafe_target')
  const redirectToPrivate = await checkLinkHealth('https://public.example/start', {
    resolve: async hostname => ({ address: hostname === 'public.example' ? '93.184.216.34' : '10.0.0.8', family: 4 }),
    request: async () => ({ statusCode: 302, location: 'http://private.example/admin' })
  })
  assert.equal(redirectToPrivate.category, 'unsafe_target')
  const dnsTimeout = await checkLinkHealth('https://slow.example/', {
    resolve: async () => new Promise(() => {}),
    request: async () => ({ statusCode: 204 })
  })
  assert.equal(dnsTimeout.category, 'timeout')
  const tooMany = await checkLinkHealth('https://public.example/0', {
    resolve: async () => ({ address: '93.184.216.34', family: 4 }),
    request: async url => ({ statusCode: 302, location: `https://public.example/${Number(url.pathname.slice(1)) + 1}` })
  })
  assert.equal(tooMany.category, 'redirect_error')
})

test('link health queue only checks published links and ignores audited items', async () => {
  const { db, repository, adminId } = await setup()
  try {
    const published = await db.query<{ id: string }>("INSERT INTO sites (title, slug, target_url, status) VALUES ('Ready', 'ready-check', 'https://public.example', 'published') RETURNING id")
    const draft = await db.query<{ id: string }>("INSERT INTO sites (title, slug, target_url, status) VALUES ('Draft', 'draft-check', 'https://draft.example', 'draft') RETURNING id")
    const selected = await repository.beginLinkHealthCheck([published.rows[0]!.id, draft.rows[0]!.id], adminId)
    assert.deepEqual(selected.map(item => item.id), [published.rows[0]!.id])
    assert.equal((await repository.listLinkHealthChecks()).find(item => item.id === published.rows[0]!.id)?.result_category, 'pending')
    assert.equal(await repository.setLinkHealthIgnored('site', published.rows[0]!.id, true, adminId), true)
    assert.equal((await repository.listLinkHealthChecks()).some(item => item.id === published.rows[0]!.id), false)
    assert.equal((await repository.listLinkHealthChecks({ includeIgnored: true })).some(item => item.id === published.rows[0]!.id), true)
    assert.equal((await db.query("SELECT count(*)::int AS count FROM admin_audit_logs WHERE resource = 'link_health'")).rows[0]!.count, 2)
  } finally { await db.close() }
})
