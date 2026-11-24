import { createHash, randomBytes } from 'node:crypto'
import { submissionSchema } from '../../../shared/schemas/content'
import type { ContentDatabase } from './content'

export const validReceipt = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
export const receiptHash = (token: string) => createHash('sha256').update(token).digest('hex')

export class SubmissionError extends Error {
  constructor(public code: 'DUPLICATE_PUBLISHED_URL' | 'RECEIPT_NOT_FOUND' | 'SUBMISSION_NOT_EDITABLE') { super(code) }
}

function validatedInput(raw: unknown) {
  const input = submissionSchema.parse(raw)
  input.payload.slug ??= `submitted-${randomBytes(16).toString('hex')}`
  return input
}

async function checkDuplicate(db: ContentDatabase, payload: Record<string, unknown>, excludedId: string | null = null) {
  if (typeof payload.targetUrl !== 'string') return
  const url = new URL(payload.targetUrl).href
  const result = await db.query(`SELECT 1 FROM (
    SELECT id, target_url FROM sites WHERE status = 'published'
    UNION ALL SELECT id, target_url FROM resources WHERE status = 'published'
  ) published WHERE submission_url_key(target_url) = submission_url_key($1) AND ($2::uuid IS NULL OR id <> $2) LIMIT 1`, [url, excludedId])
  if (result.rows.length) throw new SubmissionError('DUPLICATE_PUBLISHED_URL')
}

type SubmissionRow = { id: string; content_type: string; payload: Record<string, unknown>; status: string; published_content_id: string | null; previous_submission_id: string | null; created_at: string; reviewed_at: string | null }

export function createSubmissionReceiptsRepository(db: ContentDatabase) {
  async function find(tx: ContentDatabase, token: unknown, lock = false) {
    if (!validReceipt(token)) throw new SubmissionError('RECEIPT_NOT_FOUND')
    const receipt = await tx.query<{ submission_id: string }>(`SELECT submission_id FROM submission_receipts WHERE token_hash = $1${lock ? ' FOR UPDATE' : ''}`, [receiptHash(token)])
    if (!receipt.rows[0]) throw new SubmissionError('RECEIPT_NOT_FOUND')
    const result = await tx.query<SubmissionRow>(`SELECT id, content_type, payload, status, published_content_id, previous_submission_id, created_at, reviewed_at FROM guest_submissions WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [receipt.rows[0].submission_id])
    if (!result.rows[0]) throw new SubmissionError('RECEIPT_NOT_FOUND')
    return result.rows[0]
  }
  return {
    async submit(raw: unknown) {
      const input = validatedInput(raw)
      const token = randomBytes(32).toString('hex')
      await db.transaction(async tx => {
        await checkDuplicate(tx, input.payload)
        const result = await tx.query<{ id: string }>(`INSERT INTO guest_submissions (content_type, payload, submitter_name, contact_email) VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, '')) RETURNING id`, [input.contentType, JSON.stringify(input.payload), input.submitterName ?? '', input.contactEmail ?? ''])
        await tx.query('INSERT INTO submission_receipts (token_hash, submission_id) VALUES ($1, $2)', [receiptHash(token), result.rows[0]!.id])
      })
      return { accepted: true, receipt: token }
    },
    async status(token: unknown) {
      const row = await find(db, token)
      return { contentType: row.content_type, payload: row.payload, status: row.status, createdAt: row.created_at, reviewedAt: row.reviewed_at, editable: row.status === 'pending' || row.status === 'approved' }
    },
    async edit(token: unknown, raw: unknown) {
      const input = validatedInput(raw)
      return db.transaction(async tx => {
        const row = await find(tx, token, true)
        if (!['pending', 'approved'].includes(row.status) || row.content_type !== input.contentType) throw new SubmissionError('SUBMISSION_NOT_EDITABLE')
        const previous = row.previous_submission_id && await tx.query<{ published_content_id: string | null }>('SELECT published_content_id FROM guest_submissions WHERE id = $1', [row.previous_submission_id])
        await checkDuplicate(tx, input.payload, row.published_content_id ?? (previous ? previous.rows[0]?.published_content_id : null) ?? null)
        if (row.status === 'pending') {
          await tx.query(`UPDATE guest_submissions SET payload = $2, submitter_name = CASE WHEN $3::text IS NULL THEN submitter_name ELSE NULLIF($3, '') END, contact_email = CASE WHEN $4::text IS NULL THEN contact_email ELSE NULLIF($4, '') END WHERE id = $1 AND status = 'pending'`, [row.id, JSON.stringify(input.payload), input.submitterName ?? null, input.contactEmail ?? null])
          return { accepted: true, status: 'pending', newReview: false }
        }
        input.payload.slug = `submitted-${randomBytes(16).toString('hex')}`
        const result = await tx.query<{ id: string }>(`INSERT INTO guest_submissions (content_type, payload, submitter_name, contact_email, previous_submission_id) SELECT $1, $2, CASE WHEN $3::text IS NULL THEN submitter_name ELSE NULLIF($3, '') END, CASE WHEN $4::text IS NULL THEN contact_email ELSE NULLIF($4, '') END, id FROM guest_submissions WHERE id = $5 RETURNING id`, [input.contentType, JSON.stringify(input.payload), input.submitterName ?? null, input.contactEmail ?? null, row.id])
        await tx.query('UPDATE submission_receipts SET submission_id = $2 WHERE token_hash = $1', [receiptHash(token as string), result.rows[0]!.id])
        return { accepted: true, status: 'pending', newReview: true }
      })
    }
  }
}
