import pg from 'pg'
import { hashPassword } from '../api/server/utils/password'
import { adminLoginSchema } from '../shared/schemas/admin'

const input = adminLoginSchema.parse({ username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD })
if (input.password.length < 12) throw new Error('Administrator password must contain at least 12 characters')
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
try {
  await client.connect()
  await client.query('BEGIN')
  const result = await client.query<{ id: string }>('INSERT INTO admins (username, password_hash) VALUES ($1, $2) RETURNING id', [
    input.username,
    await hashPassword(input.password)
  ])
  await client.query("INSERT INTO admin_audit_logs (admin_id, action, resource) VALUES ($1, 'admin_created', 'auth')", [result.rows[0]!.id])
  await client.query('COMMIT')
  console.info('Administrator created. Remove ADMIN_PASSWORD from the environment after initialization.')
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  await client.end()
}
