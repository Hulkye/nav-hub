import { readdir, readFile } from 'node:fs/promises'
import pg from 'pg'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
try {
  await client.connect()
  await client.query('BEGIN')
  await client.query("SELECT pg_advisory_xact_lock(hashtext('navhub_migrations'))")
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())')
  const directory = new URL('../db/migrations/', import.meta.url)
  for (const name of (await readdir(directory)).filter(name => name.endsWith('.sql')).sort()) {
    const applied = await client.query('SELECT name FROM schema_migrations WHERE name = $1', [name])
    if (applied.rowCount) continue
    await client.query(await readFile(new URL(name, directory), 'utf8'))
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name])
    console.info(`Applied ${name}`)
  }
  await client.query('COMMIT')
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  await client.end()
}
