import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkHealth } from '../scripts/check-health.mjs'

test('monitor checks both probes and treats redirects or failures as unhealthy', async () => {
  const paths: string[] = []
  const results = await checkHealth('https://nav.example', async (url: URL) => {
    paths.push(url.pathname)
    return Response.json({ status: 'ok' }, { status: url.pathname.endsWith('ready') ? 503 : 200 })
  })
  assert.deepEqual(paths.sort(), ['/api/health/live', '/api/health/ready'])
  assert.equal(results[0].ok, true)
  assert.equal(results[1].ok, false)
  const html = await checkHealth('https://nav.example', async () => new Response('<html>Login</html>'))
  assert.ok(html.every((result: { ok: boolean }) => !result.ok))
  const incomplete = await checkHealth('https://nav.example', async () => Response.json({ status: 'ok' }))
  assert.equal(incomplete[1].ok, false)
  const failed = await checkHealth('http://localhost:3000', async () => { throw new Error('sensitive connection information') })
  assert.ok(failed.every((result: { ok: boolean }) => !result.ok))
  assert.equal(JSON.stringify(failed).includes('sensitive'), false)
  await assert.rejects(checkHealth('https://user:secret@nav.example'), /without credentials/)
})
