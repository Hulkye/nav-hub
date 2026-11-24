import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { createAuthRepository } from '../api/server/repositories/auth'
import { hashPassword, verifyPassword } from '../api/server/utils/password'

test('passwords use salted hashes and reject incorrect passwords', async () => {
  const hash = await hashPassword('a-long-test-password')
  assert.equal(await verifyPassword('a-long-test-password', hash), true)
  assert.equal(await verifyPassword('incorrect', hash), false)
  assert.notEqual(hash, await hashPassword('a-long-test-password'))
})

test('migration, session expiry/revocation, disabled admins and login limits', async () => {
  const db = new PGlite()
  try {
    await db.exec(await readFile(new URL('../db/migrations/0001_admin_foundation.sql', import.meta.url), 'utf8'))
    await db.exec(await readFile(new URL('../db/migrations/0002_content_foundation.sql', import.meta.url), 'utf8'))
    await db.exec(await readFile(new URL('../db/migrations/0003_navigation_features.sql', import.meta.url), 'utf8'))
    await db.exec(await readFile(new URL('../db/migrations/0004_content_operations.sql', import.meta.url), 'utf8'))
    const repository = createAuthRepository(db)
    const admin = await db.query<{ id: string }>("INSERT INTO admins (username, password_hash) VALUES ('test-admin', 'test-hash') RETURNING id")
    const id = admin.rows[0]!.id
    await repository.createSession(id, 'hashed-token', new Date(Date.now() + 60000))
    assert.equal((await repository.getSession('hashed-token'))?.username, 'test-admin')
    assert.equal(await repository.getSession('unknown'), undefined)
    await repository.revokeSession('hashed-token')
    assert.equal(await repository.getSession('hashed-token'), undefined)
    await repository.createSession(id, 'expired', new Date(Date.now() - 60000))
    assert.equal(await repository.getSession('expired'), undefined)
    await repository.createSession(id, 'disabled', new Date(Date.now() + 60000))
    await db.query("UPDATE admins SET status = 'disabled' WHERE id = $1", [id])
    assert.equal(await repository.getSession('disabled'), undefined)
    for (let i = 0; i < 5; i++) assert.equal(await repository.consumeLoginAttempt('ip-hash'), true)
    assert.equal(await repository.consumeLoginAttempt('ip-hash'), false)
    await db.query("UPDATE login_limits SET expires_at = now() - interval '1 minute'")
    assert.equal(await repository.consumeLoginAttempt('ip-hash'), true)
    await repository.audit(id, 'logout')
    assert.equal((await db.query('SELECT id FROM admin_audit_logs')).rows.length, 1)
    await db.query("INSERT INTO categories (name, slug) VALUES ('工具', 'tools')")
    await db.query("INSERT INTO tags (name, slug) VALUES ('精选', 'featured')")
    await db.query("INSERT INTO sites (title, slug, target_url, status) VALUES ('示例站点', 'example', 'https://example.com', 'published')")
    assert.equal((await db.query("SELECT status FROM sites WHERE slug = 'example'")).rows[0]!.status, 'published')
  } finally {
    await db.close()
  }
})
