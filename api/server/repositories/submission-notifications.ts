import type { ContentDatabase } from './content'

export function createSubmissionNotificationsRepository(db: ContentDatabase) {
  return {
    async list() {
      const result = await db.query('SELECT id, submission_id, recipient, review_status, created_at FROM submission_notification_outbox WHERE handled_at IS NULL ORDER BY created_at, id LIMIT 100')
      return { items: result.rows, delivery: 'manual' }
    },
    async handle(id: string, adminId: string) {
      return db.transaction(async tx => {
        const result = await tx.query('UPDATE submission_notification_outbox SET handled_at = now(), handled_by = $2 WHERE id = $1 AND handled_at IS NULL RETURNING id', [id, adminId])
        if (!result.rows[0]) return undefined
        await tx.query("INSERT INTO admin_audit_logs (admin_id, action, resource, resource_id) VALUES ($1, 'notification_handled', 'submission_notification', $2)", [adminId, id])
        return result.rows[0]
      })
    }
  }
}
