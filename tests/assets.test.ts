import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readdir, readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import sharp from 'sharp'
import { randomUUID } from 'node:crypto'
import { createAssetRepository } from '../api/server/repositories/assets'
import type { ContentDatabase } from '../api/server/repositories/content'
import { ImageUploadError, MAX_IMAGE_BYTES, normalizeImage } from '../api/server/utils/image-upload'
import { createApp, defineEventHandler, readMultipartFormData, toNodeListener } from 'h3'
import { createServer } from 'node:http'
import { limitUploadBody } from '../api/server/utils/upload-body'
import { articleToc, parseArticleBody } from '../shared/types/article-body'

test('article image markers parse safely without interpreting HTML or executable URLs', () => {
  const parts = parseArticleBody('开头\n![封面](/api/assets/123e4567-e89b-12d3-a456-426614174000)\n![外链](https://example.com/image.webp)\n![攻击](javascript:alert(1))\n<img src=x>')
  assert.equal(parts.filter(part => part.type === 'image').length, 2)
  assert.equal(parts.find(part => part.type === 'image')?.alt, '封面')
  assert.ok(parts.some(part => part.type === 'paragraph' && part.parts.some(inline => inline.type === 'text' && inline.text.includes('<img src=x>'))))
})

test('article markdown parses headings, TOC, lists, fenced code and safe links without rendering HTML', () => {
  const parts = parseArticleBody('# Guide\n\n## Setup\n\n- First [docs](https://example.com/docs)\n- Second\n\n```ts\nconst value = 1\n```\n\n[unsafe](javascript:alert(1)) <script>')
  assert.deepEqual(articleToc(parts).map(item => [item.level, item.text, item.id]), [[1, 'Guide', 'guide'], [2, 'Setup', 'setup']])
  const list = parts.find(part => part.type === 'list')
  assert.equal(list?.type, 'list')
  if (list?.type === 'list') assert.equal(list.items[0]?.[1]?.type, 'link')
  const code = parts.find(part => part.type === 'code')
  assert.deepEqual(code, { type: 'code', language: 'ts', value: 'const value = 1' })
  assert.ok(parts.some(part => part.type === 'paragraph' && part.parts.some(inline => inline.type === 'text' && inline.text.includes('javascript:alert(1)') && inline.text.includes('<script>'))))
})

test('images decode, strip metadata, resize and reject invalid, oversized or mismatched files', async () => {
  const png = await sharp({ create: { width: 3000, height: 1500, channels: 3, background: '#2563eb' } }).png().withMetadata().toBuffer()
  const normalized = await normalizeImage(png, 'image/png')
  assert.equal(normalized.width, 2400)
  assert.equal(normalized.height, 1200)
  const metadata = await sharp(normalized.body).metadata()
  assert.equal(metadata.format, 'webp')
  assert.equal(metadata.exif, undefined)
  await assert.rejects(normalizeImage(png, 'image/jpeg'), ImageUploadError)
  await assert.rejects(normalizeImage(Buffer.from('<svg></svg>'), 'image/svg+xml'), ImageUploadError)
  await assert.rejects(normalizeImage(Buffer.from('broken image'), 'image/png'), ImageUploadError)
  await assert.rejects(normalizeImage(Buffer.alloc(MAX_IMAGE_BYTES + 1), 'image/png'), ImageUploadError)
})

test('asset metadata persists and paginates with transactional audit', async () => {
  const db = new PGlite()
  try {
    const directory = new URL('../db/migrations/', import.meta.url)
    for (const name of (await readdir(directory)).filter(name => name.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(name, directory), 'utf8'))
    const admin = (await db.query<{ id: string }>("INSERT INTO admins (username,password_hash) VALUES ('asset-admin','hash') RETURNING id")).rows[0]!
    const repository = createAssetRepository({ query: (sql, parameters) => db.query(sql, parameters), transaction: callback => db.transaction(tx => callback(tx as ContentDatabase)) })
    const asset = { id: randomUUID(), object_key: 'images/test.webp', filename: '测试.png', content_type: 'image/webp', byte_size: 100, width: 32, height: 32 }
    await repository.create(asset, admin.id)
    assert.equal((await repository.list(1, '测试')).total, 1)
    assert.equal((await repository.list(1, 'missing')).total, 0)
    assert.equal((await repository.get(asset.id))?.filename, '测试.png')
    assert.equal((await repository.list(1)).total, 1)
    assert.equal((await repository.list(2)).items.length, 0)
    await assert.rejects(repository.create({ ...asset, id: randomUUID(), object_key: 'images/rollback.webp' }, randomUUID()))
    assert.equal((await repository.list(1)).total, 1)
    assert.equal((await db.query('SELECT * FROM admin_audit_logs')).rows.length, 1)
  } finally { await db.close() }
})

test('asset removal blocks every content reference and keeps metadata when object deletion fails', async () => {
  const db = new PGlite()
  try {
    const directory = new URL('../db/migrations/', import.meta.url)
    for (const name of (await readdir(directory)).filter(name => name.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(name, directory), 'utf8'))
    const admin = (await db.query<{ id: string }>("INSERT INTO admins (username,password_hash) VALUES ('asset-delete-admin','hash') RETURNING id")).rows[0]!
    const repository = createAssetRepository({ query: (sql, parameters) => db.query(sql, parameters), transaction: callback => db.transaction(tx => callback(tx as ContentDatabase)) })
    const asset = { id: randomUUID(), object_key: 'images/remove.webp', filename: 'remove.webp', content_type: 'image/webp', byte_size: 100, width: 32, height: 32 }
    await repository.create(asset, admin.id)
    const site = (await db.query<{ id: string }>("INSERT INTO sites (title,slug,target_url,icon_url) VALUES ('referenced','referenced','https://example.com',$1) RETURNING id", [`http://localhost:3000/api/assets/${asset.id}`])).rows[0]!
    let deleted = false
    const blocked = await repository.remove(asset.id, admin.id, async () => { deleted = true })
    assert.equal(blocked?.deleted, false)
    assert.equal(blocked?.references[0]?.content_id, site.id)
    assert.equal(deleted, false)
    await db.query('DELETE FROM sites WHERE id = $1', [site.id])
    for (const table of ['resources', 'media_items', 'articles']) {
      await db.query(`INSERT INTO ${table} (title, slug, cover_url) VALUES ('cover', 'cover', $1)`, [`https://example.com/api/assets/${asset.id}`])
      assert.equal((await repository.list(1)).items[0]!.reference_count, 1)
      assert.equal((await repository.remove(asset.id, admin.id, async () => { deleted = true }))?.deleted, false)
      await db.query(`DELETE FROM ${table} WHERE slug = 'cover'`)
    }
    await db.query("INSERT INTO articles (title, slug, body) VALUES ('body', 'body', $1)", [`![说明](/api/assets/${asset.id})`])
    assert.equal((await repository.references(asset.id))[0]?.field, 'body')
    assert.equal((await repository.remove(asset.id, admin.id, async () => { deleted = true }))?.deleted, false)
    await db.query("DELETE FROM articles WHERE slug = 'body'")
    await assert.rejects(repository.remove(asset.id, admin.id, async () => { throw new Error('storage unavailable') }))
    assert.ok(await repository.get(asset.id))
    assert.equal((await db.query('SELECT * FROM admin_audit_logs WHERE action = \'delete\'')).rows.length, 0)
    const removed = await repository.remove(asset.id, admin.id, async key => { assert.equal(key, asset.object_key); deleted = true })
    assert.equal(removed?.deleted, true)
    assert.equal(deleted, true)
    assert.equal(await repository.get(asset.id), undefined)
    await assert.rejects(db.query("INSERT INTO sites (title,slug,target_url,icon_url) VALUES ('stale','stale','https://example.com',$1)", [`http://localhost:3000/api/assets/${asset.id}`]), error => error instanceof Error && error.message.includes('Referenced image does not exist'))
    assert.equal((await db.query('SELECT * FROM admin_audit_logs WHERE action = \'delete\'')).rows.length, 1)
  } finally { await db.close() }
})

test('upload body limit bounds streamed bodies and preserves valid multipart parsing', async () => {
  const app = createApp().use(defineEventHandler(async event => {
    await limitUploadBody(event, 512)
    return { filename: (await readMultipartFormData(event))?.[0]?.filename }
  }))
  const server = createServer(toNodeListener(app))
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const address = server.address()
    assert.ok(address && typeof address !== 'string')
    const url = `http://127.0.0.1:${address.port}`
    const body = new FormData()
    body.append('file', new Blob(['small']), 'test.png')
    assert.equal((await (await fetch(url, { method: 'POST', body })).json()).filename, 'test.png')
    assert.equal((await fetch(url, { method: 'POST', body: 'x'.repeat(513) })).status, 413)
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('x'.repeat(513))); controller.close() } })
    const response = await fetch(url, { method: 'POST', body: stream, duplex: 'half' } as RequestInit & { duplex: string })
    assert.equal(response.status, 413)
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
})
