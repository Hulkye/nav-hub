import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { createSubmissionReceiptsRepository, receiptHash } from '../api/server/repositories/submission-receipts'
import { createContentRepository, type ContentDatabase } from '../api/server/repositories/content'
import { submissionDraft } from '../shared/submission-draft'
import { createSubmissionNotificationsRepository } from '../api/server/repositories/submission-notifications'
import { createServer } from 'node:http'
import { createApp, defineEventHandler, toNodeListener } from 'h3'
import { readBoundedSubmissionBody } from '../api/server/utils/submission-body'

const input = { contentType: 'site', payload: { title: 'Guest site', targetUrl: 'https://guest.example/path/', description: 'Original' }, contactEmail: 'private@example.com' }

test('receipt lifecycle validates edits, protects private data and preserves published content', async () => {
  const db = new PGlite()
  try {
    for (const migration of (await readdir(new URL('../db/migrations/', import.meta.url))).filter(file => file.endsWith('.sql')).sort()) {
      await db.exec(await readFile(new URL(`../db/migrations/${migration}`, import.meta.url), 'utf8'))
    }
    const database: ContentDatabase = { query: (sql, params) => db.query(sql, params), transaction: callback => db.transaction(tx => callback(tx as ContentDatabase)) }
    const receipts = createSubmissionReceiptsRepository(database)
    const content = createContentRepository(database)
    await db.query("INSERT INTO sites (title, slug, target_url, status) VALUES ('Private', 'private', 'https://guest.example/path/', 'draft')")
    const submitted = await receipts.submit(input)
    assert.match(submitted.receipt, /^[a-f0-9]{64}$/)
    const stored = (await db.query('SELECT * FROM submission_receipts')).rows[0]!
    assert.equal(stored.token_hash, receiptHash(submitted.receipt))
    assert.equal(JSON.stringify(stored).includes(submitted.receipt), false)
    await assert.rejects(receipts.status(stored.submission_id), /RECEIPT_NOT_FOUND/)
    await assert.rejects(receipts.status('0'.repeat(64)), /RECEIPT_NOT_FOUND/)
    await assert.rejects(receipts.status('bad'), /RECEIPT_NOT_FOUND/)
    const status = await receipts.status(submitted.receipt)
    assert.equal(status.status, 'pending')
    assert.equal(JSON.stringify(status).includes('private@example.com'), false)
    assert.equal('review_note' in status, false)
    assert.equal('id' in status, false)
    await assert.rejects(receipts.edit(submitted.receipt, { ...input, payload: { ...input.payload, targetUrl: 'javascript:alert(1)' } }))
    await assert.rejects(receipts.edit(submitted.receipt, { ...input, payload: { ...input.payload, status: 'published' } }))
    await receipts.edit(submitted.receipt, { contentType: 'site', payload: { ...input.payload, title: 'Revised' } })
    assert.equal((await receipts.status(submitted.receipt)).payload.title, 'Revised')
    assert.equal((await db.query('SELECT contact_email FROM guest_submissions WHERE id = $1', [stored.submission_id])).rows[0]!.contact_email, input.contactEmail)
    const admin = (await db.query<{ id: string }>("INSERT INTO admins (username, password_hash) VALUES ('reviewer', 'hash') RETURNING id")).rows[0]!
    await content.reviewSubmission(String(stored.submission_id), 'approved', 'Internal review note', admin.id)
    const notifications = createSubmissionNotificationsRepository(database)
    const outbox = await notifications.list()
    assert.equal(outbox.items.length, 1)
    assert.equal(outbox.items[0]!.recipient, input.contactEmail)
    assert.equal(await content.reviewSubmission(String(stored.submission_id), 'approved', null, admin.id), undefined)
    assert.equal((await notifications.list()).items.length, 1)
    await notifications.handle(String(outbox.items[0]!.id), admin.id)
    assert.equal((await notifications.list()).items.length, 0)
    assert.equal(await notifications.handle(String(outbox.items[0]!.id), admin.id), undefined)
    const approved = (await db.query('SELECT published_content_id FROM guest_submissions WHERE id = $1', [stored.submission_id])).rows[0]!
    assert.equal(JSON.stringify(await receipts.status(submitted.receipt)).includes('Internal review note'), false)
    await assert.rejects(receipts.submit(input), /DUPLICATE_PUBLISHED_URL/)
    for (const url of ['https://GUEST.example:443/path#section', 'https://guest.example/path/']) {
      await assert.rejects(receipts.submit({ ...input, payload: { ...input.payload, targetUrl: url } }), /DUPLICATE_PUBLISHED_URL/)
    }
    const edited = await receipts.edit(submitted.receipt, { contentType: 'site', payload: { ...input.payload, title: 'New review' } })
    assert.equal(edited.newReview, true)
    assert.equal((await receipts.status(submitted.receipt)).status, 'pending')
    assert.equal((await db.query('SELECT title FROM sites WHERE id = $1', [approved.published_content_id])).rows[0]!.title, 'Revised')
    await receipts.edit(submitted.receipt, { contentType: 'site', payload: { ...input.payload, title: 'Still pending' } })
    const next = (await db.query('SELECT submission_id FROM submission_receipts')).rows[0]!
    assert.notEqual(next.submission_id, stored.submission_id)
    assert.equal((await db.query('SELECT previous_submission_id FROM guest_submissions WHERE id = $1', [next.submission_id])).rows[0]!.previous_submission_id, stored.submission_id)
    await content.reviewSubmission(String(next.submission_id), 'approved', null, admin.id)
    assert.equal((await db.query("SELECT count(*)::int AS count FROM sites WHERE status = 'published'")).rows[0]!.count, 2)
    const rejected = await receipts.submit({ ...input, payload: { ...input.payload, targetUrl: 'https://rejected.example' } })
    const rejectedId = (await db.query('SELECT submission_id FROM submission_receipts WHERE token_hash = $1', [receiptHash(rejected.receipt)])).rows[0]!.submission_id
    await content.reviewSubmission(String(rejectedId), 'rejected', 'Private note', admin.id)
    assert.equal((await receipts.status(rejected.receipt)).editable, false)
    await assert.rejects(receipts.edit(rejected.receipt, input), /SUBMISSION_NOT_EDITABLE/)
    await db.query("INSERT INTO resources (title, slug, target_url, status) VALUES ('Published resource', 'resource', 'https://resource.example/', 'published')")
    await assert.rejects(receipts.submit({ ...input, payload: { ...input.payload, targetUrl: 'https://resource.example' } }), /DUPLICATE_PUBLISHED_URL/)
  } finally { await db.close() }
})

test('draft serialization never persists contact information or receipt credentials', () => {
  const draft = submissionDraft({ title: 'Saved', url: 'https://example.com', description: 'Draft', submitterName: 'Guest', contactEmail: 'private@example.com', receipt: 'secret' })
  assert.deepEqual(draft, { title: 'Saved', url: 'https://example.com', description: 'Draft', submitterName: 'Guest' })
  assert.equal(submissionDraft({ title: 'x'.repeat(200) }).title.length, 160)
  assert.equal(submissionDraft(null).title, '')
})

test('submission body parsing enforces size for declared and chunked requests', async () => {
  const server = createServer(toNodeListener(createApp().use(defineEventHandler(event => readBoundedSubmissionBody(event)))))
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const address = server.address()
    assert.ok(address && typeof address !== 'string')
    const url = `http://127.0.0.1:${address.port}`
    const valid = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ receipt: 'test' }) })
    assert.deepEqual(await valid.json(), { receipt: 'test' })
    assert.equal((await fetch(url, { method: 'POST', body: 'x'.repeat(256 * 1024 + 1) })).status, 413)
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('x'.repeat(256 * 1024 + 1))); controller.close() } })
    assert.equal((await fetch(url, { method: 'POST', body: stream, duplex: 'half' } as RequestInit & { duplex: string })).status, 413)
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
})
