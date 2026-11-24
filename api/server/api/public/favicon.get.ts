import { resolvePublic } from '../../utils/link-health'
import http from 'node:http'
import https from 'node:https'
import { isIP } from 'node:net'

const maxHtmlBytes = 512 * 1024

function safeHttpUrl(raw: string) {
  try {
    const url = new URL(raw)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return undefined
    return url
  } catch {
    return undefined
  }
}

async function readPage(url: URL) {
  const address = await resolvePublic(url.hostname)
  return new Promise<{ status: number; location?: string; html: string }>((resolve, reject) => {
    const secure = url.protocol === 'https:'
    const request = (secure ? https : http).request(
      {
        hostname: address.address,
        family: address.family,
        port: url.port || (secure ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        headers: {
          Host: url.host,
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': 'NavHub-Favicon/1.0',
          'Accept-Encoding': 'identity'
        },
        ...(secure && !isIP(url.hostname) ? { servername: url.hostname } : {}),
        agent: false
      },
      response => {
        const status = response.statusCode ?? 0
        if (status >= 300 && status < 400) {
          resolve({ status, location: response.headers.location, html: '' })
          response.destroy()
          return
        }
        if (status !== 200 || !response.headers['content-type']?.includes('text/html')) {
          reject(new Error(`Favicon page returned ${status} or non-HTML content`))
          response.destroy()
          return
        }
        const chunks: Buffer[] = []
        let bytes = 0
        response.on('data', (chunk: Buffer) => {
          bytes += chunk.length
          if (bytes > maxHtmlBytes) {
            resolve({ status, html: Buffer.concat(chunks).toString('utf8') })
            response.destroy()
          } else chunks.push(chunk)
        })
        response.once('end', () => resolve({ status, html: Buffer.concat(chunks).toString('utf8') }))
        response.once('error', reject)
      }
    )
    const deadline = setTimeout(() => request.destroy(new Error('Favicon page request timed out')), 5000)
    request.once('close', () => clearTimeout(deadline))
    request.once('error', reject)
    request.end()
  })
}

function declaredIcon(html: string, base: URL) {
  const links = html.match(/<link\b[^>]*>/gi) ?? []
  for (const link of links) {
    const rel =
      link
        .match(/\brel\s*=\s*["']([^"']+)["']/i)?.[1]
        ?.toLowerCase()
        .split(/\s+/) ?? []
    if (!rel.includes('icon') && !rel.includes('shortcut')) continue
    const href = link.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1]
    let icon: URL | undefined
    try {
      icon = href ? safeHttpUrl(new URL(href.replace(/&amp;/g, '&'), base).href) : undefined
    } catch {
      continue
    }
    if (icon) return icon
  }

  return undefined
}

export default defineEventHandler(async event => {
  const raw = getQuery(event).url
  const target = safeHttpUrl(typeof raw === 'string' ? raw : '')
  if (!target) throw createError({ statusCode: 400, statusMessage: 'Invalid favicon URL' })
  try {
    let current = target
    for (let redirects = 0; redirects <= 3; redirects++) {
      const response = await readPage(current)
      if (response.location) {
        const next = safeHttpUrl(new URL(response.location, current).href)
        if (!next) throw new Error('Invalid favicon page redirect')
        current = next
        continue
      }
      const icon = declaredIcon(response.html, current)
      if (icon) return sendRedirect(event, icon.href, 302)
      break
    }
  } catch (error) {
    console.warn('[favicon] page discovery failed', error instanceof Error ? error.message : 'Unknown error')
  }
  const fallback = new URL('https://t1.gstatic.cn/faviconV2')
  fallback.search = new URLSearchParams({
    client: 'SOCIAL',
    type: 'FAVICON',
    fallback_opts: 'TYPE,SIZE,URL',
    url: target.origin,
    size: '128'
  }).toString()
  return sendRedirect(event, fallback.href, 302)
})
