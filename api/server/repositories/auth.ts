export interface Database {
  query<T extends Record<string, unknown>>(sql: string, parameters?: unknown[]): Promise<{ rows: T[] }>
}

export function createAuthRepository(db: Database) {
  return {
    async findAdmin(username: string) {
      const result = await db.query<{ id: string; username: string; password_hash: string }>(
        "SELECT id, username, password_hash FROM admins WHERE username = $1 AND status = 'active'", [username]
      )
      return result.rows[0]
    },
    async createSession(adminId: string, tokenHash: string, expiresAt: Date) {
      await db.query('INSERT INTO admin_sessions (admin_id, token_hash, expires_at) VALUES ($1, $2, $3)', [adminId, tokenHash, expiresAt])
      await db.query('UPDATE admins SET last_login_at = now(), updated_at = now() WHERE id = $1', [adminId])
    },
    async getSession(tokenHash: string) {
      const result = await db.query<{ id: string; admin_id: string; username: string }>(
        `SELECT s.id, a.id AS admin_id, a.username FROM admin_sessions s
         JOIN admins a ON a.id = s.admin_id
         WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND a.status = 'active'`, [tokenHash]
      )
      return result.rows[0]
    },
    async revokeSession(tokenHash: string) {
      await db.query('UPDATE admin_sessions SET revoked_at = now(), updated_at = now() WHERE token_hash = $1 AND revoked_at IS NULL', [tokenHash])
    },
    async consumeLoginAttempt(key: string) {
      const result = await db.query<{ attempts: number }>(
        `INSERT INTO login_limits (key, attempts, expires_at) VALUES ($1, 1, now() + interval '15 minutes')
         ON CONFLICT (key) DO UPDATE SET
           attempts = CASE WHEN login_limits.expires_at <= now() THEN 1 ELSE login_limits.attempts + 1 END,
           expires_at = CASE WHEN login_limits.expires_at <= now() THEN now() + interval '15 minutes' ELSE login_limits.expires_at END
         RETURNING attempts`, [key]
      )
      return result.rows[0]!.attempts <= 5
    },
    async audit(adminId: string | null, action: string, resourceId?: string) {
      await db.query('INSERT INTO admin_audit_logs (admin_id, action, resource, resource_id) VALUES ($1, $2, $3, $4)', [adminId, action, 'auth', resourceId ?? null])
    }
  }
}
