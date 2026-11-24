import { pathToFileURL } from 'node:url'

export async function checkHealth(baseUrl, fetcher = fetch) {
  const base = new URL(baseUrl)
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash || base.pathname !== '/') throw new Error('HEALTH_BASE_URL must be an HTTP(S) origin without credentials')
  return Promise.all(['live', 'ready'].map(async probe => {
    const started = Date.now()
    try {
      const response = await fetcher(new URL(`/api/health/${probe}`, base), { signal: AbortSignal.timeout(5000), redirect: 'error' })
      if (response.status !== 200) {
        await response.body?.cancel()
        return { probe, ok: false, status: response.status, durationMs: Date.now() - started }
      }
      const payload = await response.json()
      const ok = payload?.status === 'ok' && (probe !== 'ready' || payload?.checks?.database === 'ok')
      return { probe, ok, status: response.status, durationMs: Date.now() - started }
    } catch (error) {
      return { probe, ok: false, status: null, durationMs: Date.now() - started, error: error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'connection_failed' }
    }
  }))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const results = await checkHealth(process.env.HEALTH_BASE_URL || 'http://localhost:3000')
    console.log(JSON.stringify({ timestamp: new Date().toISOString(), ok: results.every(result => result.ok), probes: results }))
    if (results.some(result => !result.ok)) process.exitCode = 1
  } catch {
    console.error('[health] Invalid HEALTH_BASE_URL configuration')
    process.exitCode = 1
  }
}
