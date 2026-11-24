import { readFile, readdir, stat } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'
import { spawnSync } from 'node:child_process'

const workspaces = ['app', 'admin', 'api']
const placeholders = /REPLACE[_ -]|CHANGE[_ -]?ME|YOUR[_ -]|^(password|secret|example)$/i

export function checkEnvironment(env) {
  const errors = []
  for (const key of ['DATABASE_URL', 'NUXT_PUBLIC_SITE_URL', 'S3_ENDPOINT', 'S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']) {
    if (!env[key]?.trim() || placeholders.test(env[key])) errors.push(`${key}: required; replace empty/example values`)
  }
  for (const [key, protocols] of [['DATABASE_URL', ['postgres:', 'postgresql:']], ['NUXT_PUBLIC_SITE_URL', ['https:']], ['S3_ENDPOINT', ['http:', 'https:']], ['API_ORIGIN', ['http:', 'https:']], ['ADMIN_ORIGIN', ['http:', 'https:']]]) {
    if (!env[key]) continue
    try {
      const url = new URL(env[key])
      if (!protocols.includes(url.protocol) || !url.hostname || url.hash || (key !== 'DATABASE_URL' && (url.username || url.password || url.search || url.pathname !== '/'))) throw new Error()
      if (key === 'DATABASE_URL' && (!url.username || decodeURIComponent(url.password).length < 16 || placeholders.test(decodeURIComponent(url.password)) || url.pathname === '/')) throw new Error()
    } catch {
      errors.push(`${key}: invalid URL${key === 'NUXT_PUBLIC_SITE_URL' ? '; production requires HTTPS origin' : ''}`)
    }
  }
  if (env.S3_SECRET_ACCESS_KEY && env.S3_SECRET_ACCESS_KEY.length < 16) errors.push('S3_SECRET_ACCESS_KEY: use at least 16 characters')
  if (env.POSTGRES_PASSWORD && (env.POSTGRES_PASSWORD.length < 16 || placeholders.test(env.POSTGRES_PASSWORD))) errors.push('POSTGRES_PASSWORD: use a non-placeholder password of at least 16 characters')
  if (!['true', 'false'].includes(env.S3_FORCE_PATH_STYLE || '')) errors.push('S3_FORCE_PATH_STYLE: must be true or false')
  if (env.ADMIN_PASSWORD) errors.push('ADMIN_PASSWORD: remove bootstrap password from deployment environment')
  for (const key of Object.keys(env)) {
    if (/^(NUXT_PUBLIC_|VITE_|NEXT_PUBLIC_)/.test(key) && /PASSWORD|SECRET|TOKEN|DATABASE|ACCESS_KEY/i.test(key)) errors.push(`${key.replace(/[^A-Z0-9_]/g, '?')}: credentials must not be public`)
  }
  return errors
}

export function checkMigrations(names) {
  const errors = []
  const seen = new Set()
  const files = names.filter(name => name.endsWith('.sql')).sort()
  if (!files.length) errors.push('migrations: no SQL migrations found')
  for (const name of files) {
    if (!/^\d{4}_[a-z0-9_]+\.sql$/.test(name)) errors.push('migrations: filenames must use NNNN_lowercase_name.sql')
    const prefix = name.slice(0, 4)
    if (seen.has(prefix)) errors.push(`migrations: duplicate sequence ${/^\d{4}$/.test(prefix) ? prefix : '(invalid)'}`)
    seen.add(prefix)
  }
  return errors
}

// Only fixed diagnostics are returned: never print child output, response bodies or configuration values.
export function runDocker(args) {
  const result = spawnSync('docker', args, { encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
  return !result.error && result.status === 0
}

export async function probeHealth(base, fetcher = fetch) {
  let origin
  try {
    const url = new URL(base)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error()
    origin = url.origin
  } catch {
    return [{ status: 'ERROR', message: 'health: base URL must be an HTTP(S) origin without credentials, query or path' }]
  }
  const results = []
  for (const probe of ['live', 'ready']) {
    let responded = false
    try {
      const response = await fetcher(`${origin}/api/health/${probe}`, { signal: AbortSignal.timeout(3000), redirect: 'manual', headers: { accept: 'application/json' } })
      responded = true
      if (response.status !== 200) {
        await response.body?.cancel()
        results.push({ status: 'ERROR', message: `health/${probe}: expected HTTP 200` })
        continue
      }
      const body = await response.json()
      const ok = body?.status === 'ok' && (probe !== 'ready' || body?.checks?.database === 'ok')
      results.push({ status: ok ? 'OK' : 'ERROR', message: `health/${probe}: ${ok ? 'healthy' : 'invalid health response'}` })
    } catch {
      results.push({ status: responded ? 'ERROR' : 'UNAVAILABLE', message: `health/${probe}: ${responded ? 'invalid health response' : 'unavailable or timed out'}` })
    }
  }
  return results
}

export async function checkDeployment({ root = process.cwd(), env = process.env, docker = runDocker, fetcher = fetch, healthBase, staticOnly = false } = {}) {
  const results = []
  const report = (status, message) => results.push({ status, message })
  const read = async path => {
    try { return await readFile(join(root, path), 'utf8') } catch { report('ERROR', `${path}: missing or unreadable`); return '' }
  }
  const requireMatch = (text, pattern, message) => { if (!pattern.test(text)) report('ERROR', message) }
  let localEnv = {}
  try { localEnv = parseEnv(await readFile(join(root, '.env'), 'utf8')) } catch (error) {
    report(error.code === 'ENOENT' ? 'SKIP' : 'ERROR', '.env: not available; use injected environment variables or a valid .env')
  }
  const config = { ...localEnv, ...env }
  for (const error of checkEnvironment(config)) report('ERROR', error)
  const example = parseEnv(await read('.env.example'))
  for (const key of ['DATABASE_URL', 'NUXT_PUBLIC_SITE_URL', 'S3_ENDPOINT', 'S3_SECRET_ACCESS_KEY']) {
    if (!(key in example)) report('ERROR', `.env.example: missing ${key}`)
  }
  const dockerfile = await read('Dockerfile')
  requireMatch(dockerfile, /FROM node:24[^\n]* AS build/i, 'Dockerfile: expected Node 24 build stage')
  requireMatch(dockerfile, /RUN npm ci/, 'Dockerfile: use npm ci with lockfile')
  requireMatch(dockerfile, /RUN npm run build/, 'Dockerfile: missing workspace build')
  requireMatch(dockerfile, /CMD \["node", "scripts\/run-applications\.mjs", "start"\]/, 'Dockerfile: missing production entrypoint')
  for (const name of workspaces) requireMatch(dockerfile, new RegExp(`COPY --from=build /app/${name}/\\.output`), `Dockerfile: missing ${name} production output`)
  const ignore = await read('.dockerignore')
  for (const rule of ['.env', '.env.*', '**/.env', '**/.env.*', '**/node_modules', '**/.output', 'backups']) {
    if (!ignore.split(/\r?\n/).includes(rule)) report('ERROR', `.dockerignore: missing exclusion ${rule}`)
  }
  if (/^\s*(?:ARG|ENV)\s+\w*(?:PASSWORD|SECRET|TOKEN|DATABASE_URL|ACCESS_KEY)\b/im.test(dockerfile)) report('ERROR', 'Dockerfile: do not bake credentials into ARG/ENV')
  const compose = await read('docker-compose.yml')
  for (const name of ['postgres', 'minio', 'minio-init']) requireMatch(compose, new RegExp(`^  ${name}:`, 'm'), `compose: missing ${name} service`)
  requireMatch(compose, /POSTGRES_PASSWORD:\s*\$\{POSTGRES_PASSWORD:\?/, 'compose: require explicit database password')
  requireMatch(compose, /MINIO_ROOT_PASSWORD:\s*\$\{S3_SECRET_ACCESS_KEY:\?/g, 'compose: require explicit object storage password')
  requireMatch(compose, /condition:\s*service_healthy/, 'compose: storage initialization must wait for health')
  requireMatch(compose, /pg_isready/, 'compose: missing PostgreSQL healthcheck')
  requireMatch(compose, /["']mc["'],\s*["']ready["']/, 'compose: missing MinIO healthcheck')
  for (const line of compose.split('\n')) {
    if (/^\s*-\s*["']?(?:\d+|0\.0\.0\.0):\d+/.test(line)) report('ERROR', 'compose: dependency ports must bind to loopback')
  }
  await read('package-lock.json')
  const pkgText = await read('package.json')
  try {
    const pkg = JSON.parse(pkgText)
    if (!pkg.scripts?.['db:migrate'] || !pkg.scripts?.build || !pkg.scripts?.start) report('ERROR', 'package.json: missing migrate/build/start scripts')
  } catch { report('ERROR', 'package.json: invalid JSON') }
  const migrate = await read('scripts/migrate.ts')
  requireMatch(migrate, /\.filter\([^\n]*\.endsWith\('\.sql'\)[^\n]*\.sort\(\)/, 'migration runner: SQL files must be sorted lexically')
  for (const token of ['BEGIN', 'pg_advisory_xact_lock', 'schema_migrations', 'COMMIT', 'ROLLBACK']) {
    if (!migrate.includes(token)) report('ERROR', `migration runner: missing ${token}`)
  }
  try {
    for (const error of checkMigrations(await readdir(join(root, 'db/migrations')))) report('ERROR', error)
  } catch { report('ERROR', 'migrations: missing directory') }
  report('INFO', 'ordering: backup → db:migrate → build → deploy:check → start → health verification; database migration state is not queried')
  for (const probe of ['live', 'ready']) {
    const source = await read(`api/server/api/health/${probe}.get.ts`)
    requireMatch(source, /defineEventHandler/, `health/${probe}: missing handler`)
    if (probe === 'ready') {
      requireMatch(source, /SELECT 1/, 'health/ready: missing database check')
      requireMatch(source, /statusCode:\s*503/, 'health/ready: missing unavailable status')
    }
  }
  const secrets = ['POSTGRES_PASSWORD', 'DATABASE_URL', 'S3_SECRET_ACCESS_KEY', 'ADMIN_PASSWORD'].map(key => config[key]).filter(value => value && value.length >= 8 && !placeholders.test(value))
  async function scanPublic(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) { report('ERROR', 'public artifacts: symbolic link requires manual review'); continue }
      const path = join(directory, entry.name)
      if (entry.isDirectory()) await scanPublic(path)
      else if (entry.isFile()) {
        const bytes = await readFile(path)
        if (secrets.some(secret => bytes.includes(Buffer.from(secret)))) report('ERROR', 'public artifacts: configured secret detected; rebuild with safe configuration')
        if (/^\.env(?:\.|$)/.test(entry.name)) report('ERROR', 'public artifacts: environment file detected')
      }
    }
  }
  for (const name of workspaces) {
    for (const artifact of ['server/index.mjs', 'server/package.json', 'nitro.json']) {
      try { if (!(await stat(join(root, name, '.output', artifact))).size) throw new Error() } catch { report('ERROR', `${name}/.output/${artifact}: missing/empty; run npm run build`) }
    }
    if (name !== 'api') {
      try { await scanPublic(join(root, name, '.output/public')) } catch { report('ERROR', `${name}/.output/public: unreadable; run npm run build`) }
    }
  }
  if (staticOnly) report('SKIP', 'Docker and HTTP probes: disabled by --static')
  else {
    if (!docker(['compose', 'version'])) report('SKIP', 'Docker Compose unavailable; static checks still ran')
    else {
      if (!docker(['compose', '--project-directory', root, 'config', '--quiet'])) report('ERROR', 'Docker Compose config validation failed; check YAML and required variables (details suppressed)')
      report(docker(['info', '--format', '{{.ServerVersion}}']) ? 'OK' : 'SKIP', 'Docker daemon availability (no containers started)')
    }
    const probes = await probeHealth(healthBase || 'http://127.0.0.1:3002', fetcher)
    const allUnavailable = probes.every(probe => probe.status === 'UNAVAILABLE')
    for (const probe of probes) report(probe.status === 'UNAVAILABLE' ? (!healthBase && allUnavailable ? 'SKIP' : 'ERROR') : probe.status, probe.message)
  }
  if (!results.some(result => result.status === 'ERROR')) report('OK', 'static deployment checks passed; skipped probes are not production acceptance')
  return results
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  if (args.some(arg => arg !== '--static' && !arg.startsWith('--health-base='))) {
    console.error('[ERROR] Usage: npm run deploy:check -- [--static] [--health-base=http://127.0.0.1:3002]')
    process.exitCode = 1
  } else {
    try {
      const results = await checkDeployment({ staticOnly: args.includes('--static'), healthBase: args.find(arg => arg.startsWith('--health-base='))?.slice(14) || process.env.HEALTH_BASE_URL })
      for (const result of results) console.log(`[${result.status}] ${result.message}`)
      process.exitCode = results.some(result => result.status === 'ERROR') ? 1 : 0
    } catch {
      console.error('[ERROR] Deployment check failed; check file permissions and configuration (details suppressed)')
      process.exitCode = 1
    }
  }
}
