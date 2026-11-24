import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { createRankingsRepository } from '../api/server/repositories/rankings'
import { runScheduledLinkHealth } from '../api/server/repositories/scheduled-link-health'

async function setup() {
  const db = new PGlite()
  for (const migration of ['0002_content_foundation', '0003_navigation_features', '0006_content_events', '0008_link_health', '0020_link_health_schedule', '0029_link_health_latency']) {
    await db.exec(await readFile(new URL(`../db/migrations/${migration}.sql`, import.meta.url), 'utf8'))
  }
  return db
}

test('rankings aggregate only published content and events inside the selected window', async () => {
  const db = await setup()
  try {
    const sites = await db.query<{ id: string }>("INSERT INTO sites (title, slug, target_url, status) VALUES ('Visible', 'visible', 'https://example.com', 'published'), ('Draft', 'draft', 'https://example.org', 'draft') RETURNING id")
    for (const site of sites.rows) await db.query("INSERT INTO content_events (event_type, content_type, content_id, dedupe_key) VALUES ('view', 'site', $1, $2)", [site.id, site.id])
    await db.query("INSERT INTO content_events (event_type, content_type, content_id, dedupe_key, occurred_at) VALUES ('outbound_click', 'site', $1, 'old', now() - interval '10 days')", [sites.rows[0]!.id])
    const repository = createRankingsRepository(db)
    await db.query('UPDATE sites SET icon_url = $1 WHERE id = $2', ['https://example.com/logo.png', sites.rows[0]!.id])
    const [ranked] = await repository.list(7)
    assert.equal(ranked?.icon_url, 'https://example.com/logo.png')
    assert.equal(ranked?.target_url, 'https://example.com')
    assert.equal((await repository.list(7)).length, 1)
    assert.equal((await repository.list(7))[0]!.clicks, 0)
    assert.equal((await repository.list(30))[0]!.clicks, 1)
    assert.equal((await repository.list(30))[0]!.views, 1)
  } finally { await db.close() }
})

test('scheduled checks skip ignored, fresh and unpublished targets and persist run failures', async () => {
  const db = await setup()
  try {
    const sites = await db.query<{ id: string; slug: string }>("INSERT INTO sites (title, slug, target_url, status) VALUES ('New', 'new', 'https://new.example', 'published'), ('Ignored', 'ignored', 'https://ignored.example', 'published'), ('Fresh', 'fresh', 'https://fresh.example', 'published'), ('Draft', 'draft', 'https://draft.example', 'draft') RETURNING id, slug")
    for (const site of sites.rows.filter(site => ['ignored', 'fresh'].includes(site.slug))) await db.query("INSERT INTO link_health_checks (content_type, content_id, result_category, ignored_at) VALUES ('site', $1, 'ok', $2)", [site.id, site.slug === 'ignored' ? new Date().toISOString() : null])
    const checked: string[] = []
    const result = await runScheduledLinkHealth(db, async url => { checked.push(url); return { category: 'http_error', statusCode: 404, summary: 'HTTP 错误', elapsedMs: 250 } })
    assert.deepEqual(checked, ['https://new.example'])
    assert.equal(result.failed, 1)
    assert.equal((await db.query('SELECT elapsed_ms FROM link_health_checks WHERE content_id = $1', [sites.rows[0]!.id])).rows[0]!.elapsed_ms, 250)
    assert.equal((await db.query('SELECT status FROM link_health_schedule_runs WHERE id = $1', [result.runId])).rows[0]!.status, 'completed')
    await db.query("UPDATE link_health_checks SET checked_at = now() - interval '2 days' WHERE content_id = $1", [sites.rows[0]!.id])
    await assert.rejects(runScheduledLinkHealth(db, async () => { throw new Error('worker failed') }), /worker failed/)
    assert.equal((await db.query("SELECT count(*)::int AS count FROM link_health_schedule_runs WHERE status = 'failed'")).rows[0]!.count, 1)
  } finally { await db.close() }
})
