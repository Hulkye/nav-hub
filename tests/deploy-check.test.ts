import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdir, writeFile, rm, cp } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { checkDeployment, checkEnvironment, checkMigrations, probeHealth } from '../scripts/deploy-check.mjs'

const environment = {
  DATABASE_URL: 'postgresql://navhub:generated-test-value@localhost:5432/navhub',
  NUXT_PUBLIC_SITE_URL: 'https://navhub.example.org',
  POSTGRES_PASSWORD: 'generated-test-value',
  S3_ENDPOINT: 'http://127.0.0.1:9000',
  S3_REGION: 'us-east-1', S3_BUCKET: 'navhub', S3_ACCESS_KEY_ID: 'navhub',
  S3_SECRET_ACCESS_KEY: 'test-only-storage-value', S3_FORCE_PATH_STYLE: 'true'
}

test('deployment config rejects placeholders, unsafe public values and bootstrap passwords without echoing values', () => {
  assert.deepEqual(checkEnvironment(environment), [])
  const errors = checkEnvironment({ ...environment, DATABASE_URL: 'postgresql://navhub:REPLACE_WITH_PASSWORD@localhost/navhub', NUXT_PUBLIC_SITE_URL: 'http://localhost:3000', S3_SECRET_ACCESS_KEY: 'REPLACE_WITH_RANDOM_VALUE', ADMIN_PASSWORD: 'sensitive-bootstrap', NUXT_PUBLIC_TOKEN: 'sensitive-public' })
  assert.ok(errors.some((error: string) => error.startsWith('DATABASE_URL:')))
  assert.ok(errors.some((error: string) => error.includes('HTTPS')))
  assert.ok(errors.some((error: string) => error.startsWith('ADMIN_PASSWORD:')))
  assert.ok(errors.some((error: string) => error.includes('must not be public')))
  assert.doesNotMatch(errors.join('\n'), /sensitive-|REPLACE_WITH/)
  assert.ok(checkEnvironment({ ...environment, API_ORIGIN: 'https://user:credential@example.org' }).length)
  assert.ok(checkEnvironment({ ...environment, DATABASE_URL: 'postgresql://navhub:password@localhost/navhub' }).length)
})

test('migration ordering accepts gaps but rejects ambiguous sequences and malformed names', () => {
  assert.deepEqual(checkMigrations(['0017_next.sql', '0001_initial.sql', 'README.md']), [])
  assert.ok(checkMigrations(['0001_initial.sql', '0001_duplicate.sql']).some((error: string) => error.includes('duplicate')))
  assert.ok(checkMigrations(['2_wrong.sql']).length)
  assert.ok(checkMigrations([]).length)
})

test('health probes validate readiness payload, reject redirects/failures and redact responses', async () => {
  const healthy = async () => new Response(JSON.stringify({ status: 'ok', checks: { database: 'ok' } }))
  assert.ok((await probeHealth('http://localhost:3002', healthy)).every((result: { status: string }) => result.status === 'OK'))
  const invalid = await probeHealth('http://localhost:3002', async () => new Response(JSON.stringify({ status: 'ok', secret: 'never-log-this' })))
  assert.equal(invalid[1].status, 'ERROR')
  const failed = await probeHealth('http://localhost:3002', async () => new Response('never-log-this', { status: 503 }))
  assert.ok(failed.every((result: { status: string }) => result.status === 'ERROR'))
  const redirected = await probeHealth('http://localhost:3002', async (_url: string, options: RequestInit) => {
    assert.equal(options.redirect, 'manual')
    return new Response(null, { status: 302, headers: { location: 'https://example.org' } })
  })
  assert.ok(redirected.every((result: { status: string }) => result.status === 'ERROR'))
  assert.doesNotMatch(JSON.stringify([...invalid, ...failed]), /never-log-this/)
  assert.ok((await probeHealth('http://localhost:3002', async () => new Response('not-json'))).every((result: { status: string }) => result.status === 'ERROR'))
  assert.equal((await probeHealth('http://user:never-log-this@localhost'))[0].status, 'ERROR')
})

test('static deployment checks, optional Docker, artifacts and strict explicit probes', async () => {
  const root = join(process.cwd(), `.deploy-check-test-${randomUUID()}`)
  await mkdir(root)
  try {
    for (const path of ['Dockerfile', '.dockerignore', 'docker-compose.yml', '.env.example', 'package.json', 'package-lock.json', 'scripts/migrate.ts', 'db/migrations', 'api/server/api/health']) {
      await mkdir(join(root, path, '..'), { recursive: true })
      await cp(join(process.cwd(), path), join(root, path), { recursive: true })
    }
    for (const name of ['app', 'admin', 'api']) {
      await mkdir(join(root, name, '.output/server'), { recursive: true })
      for (const path of ['server/index.mjs', 'server/package.json', 'nitro.json']) await writeFile(join(root, name, '.output', path), '{}')
      if (name !== 'api') await mkdir(join(root, name, '.output/public'), { recursive: true })
    }
    const unavailable = async () => { throw new Error('secret-connection-detail') }
    const options = { root, env: environment, docker: () => false, fetcher: unavailable }
    const results = await checkDeployment(options)
    assert.ok(!results.some((result: { status: string }) => result.status === 'ERROR'), JSON.stringify(results))
    assert.ok(results.some((result: { status: string; message: string }) => result.status === 'SKIP' && result.message.includes('Docker')))
    const strict = await checkDeployment({ ...options, healthBase: 'http://localhost:3002' })
    assert.ok(strict.some((result: { status: string; message: string }) => result.status === 'ERROR' && result.message.includes('health/ready')))
    assert.doesNotMatch(JSON.stringify(strict), /secret-connection-detail/)
    let probed = false
    const staticResults = await checkDeployment({ ...options, staticOnly: true, docker: () => { probed = true; return false }, fetcher: async () => { probed = true; return new Response() } })
    assert.equal(probed, false)
    assert.ok(!staticResults.some((result: { status: string }) => result.status === 'ERROR'))
    const dockerFailure = await checkDeployment({ ...options, docker: (args: string[]) => args[0] === 'compose' && args[1] === 'version' })
    assert.ok(dockerFailure.some((result: { status: string; message: string }) => result.status === 'ERROR' && result.message.includes('Compose config')))
    const cli = () => spawnSync(process.execPath, [join(process.cwd(), 'scripts/deploy-check.mjs'), '--static'], { cwd: root, env: environment, encoding: 'utf8' })
    assert.equal(cli().status, 0)
    await writeFile(join(root, 'app/.output/public/leak.js'), environment.S3_SECRET_ACCESS_KEY)
    await rm(join(root, 'admin/.output/server/index.mjs'))
    await writeFile(join(root, '.dockerignore'), '')
    const broken = await checkDeployment({ ...options, staticOnly: true })
    assert.ok(broken.some((result: { message: string }) => result.message.includes('secret detected')))
    assert.ok(broken.some((result: { message: string }) => result.message.includes('admin/.output/server/index.mjs')))
    assert.ok(broken.some((result: { message: string }) => result.message.includes('missing exclusion')))
    assert.doesNotMatch(JSON.stringify(broken), new RegExp(environment.S3_SECRET_ACCESS_KEY))
    const failure = cli()
    assert.equal(failure.status, 1)
    assert.doesNotMatch(failure.stdout + failure.stderr, new RegExp(environment.S3_SECRET_ACCESS_KEY))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
