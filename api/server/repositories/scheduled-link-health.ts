import type { ContentDatabase } from './content'
import type { LinkHealthResult } from '../utils/link-health'

export async function runScheduledLinkHealth(db: ContentDatabase, check: (url: string) => Promise<LinkHealthResult>, limit = 100) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('INVALID_CHECK_LIMIT')
  const run = await db.query<{ id: string }>("INSERT INTO link_health_schedule_runs DEFAULT VALUES RETURNING id")
  const id = run.rows[0]!.id
  let checked = 0
  let failed = 0
  try {
    const targets = await db.query<{ id: string; content_type: 'site' | 'resource'; target_url: string }>(`
      SELECT c.id, c.content_type, c.target_url FROM (
        SELECT id, 'site' AS content_type, target_url FROM sites WHERE status = 'published'
        UNION ALL SELECT id, 'resource', target_url FROM resources WHERE status = 'published' AND target_url IS NOT NULL
      ) c LEFT JOIN link_health_checks h ON h.content_id = c.id AND h.content_type = c.content_type
      WHERE h.ignored_at IS NULL AND (h.checked_at IS NULL OR h.checked_at < now() - interval '24 hours')
      ORDER BY h.checked_at ASC NULLS FIRST, c.content_type, c.id LIMIT $1`, [limit])
    for (const target of targets.rows) {
      const result = await check(target.target_url)
      await db.query(`INSERT INTO link_health_checks (content_type, content_id, checked_at, result_category, status_code, error_summary, elapsed_ms)
        SELECT $1, id, now(), $3, $4, $5, $6 FROM ${target.content_type === 'site' ? 'sites' : 'resources'} WHERE id = $2 AND status = 'published' AND target_url = $7
        ON CONFLICT (content_type, content_id) DO UPDATE SET checked_at = now(), result_category = EXCLUDED.result_category, status_code = EXCLUDED.status_code, error_summary = EXCLUDED.error_summary, elapsed_ms = EXCLUDED.elapsed_ms WHERE link_health_checks.ignored_at IS NULL`, [target.content_type, target.id, result.category, result.statusCode, result.summary, result.elapsedMs, target.target_url])
      checked++
      if (result.category !== 'ok') failed++
    }
    await db.query("UPDATE link_health_schedule_runs SET status = 'completed', completed_at = now(), checked_count = $2, failed_count = $3 WHERE id = $1", [id, checked, failed])
    return { runId: id, checked, failed }
  } catch (error) {
    await db.query("UPDATE link_health_schedule_runs SET status = 'failed', completed_at = now(), checked_count = $2, failed_count = $3 WHERE id = $1", [id, checked, failed])
    throw error
  }
}
