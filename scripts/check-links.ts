import pg from 'pg'
import { runScheduledLinkHealth } from '../api/server/repositories/scheduled-link-health'
import { checkLinkHealth } from '../api/server/utils/link-health'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 })
await client.connect()
try {
  const lock = await client.query<{ acquired: boolean }>("SELECT pg_try_advisory_lock(739421, 20) AS acquired")
  if (!lock.rows[0]!.acquired) {
    console.log('[link-health] another scheduled worker is running')
  } else {
    try {
      await client.query("UPDATE link_health_schedule_runs SET status = 'failed', completed_at = now() WHERE status = 'running'")
      const result = await runScheduledLinkHealth({ query: (sql, parameters) => client.query(sql, parameters), transaction: async () => { throw new Error('TRANSACTION_NOT_SUPPORTED') } }, checkLinkHealth)
      console.log('[link-health]', result)
      if (result.failed) console.warn('[link-health] failures found; review /admin/link-health')
    } finally { await client.query('SELECT pg_advisory_unlock(739421, 20)') }
  }
} finally { await client.end() }
