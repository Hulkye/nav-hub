import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import http from 'node:http'
import https from 'node:https'

export type LinkHealthCategory = 'ok' | 'http_error' | 'timeout' | 'dns_error' | 'unsafe_target' | 'redirect_error' | 'network_error'
export interface LinkHealthResult { category: LinkHealthCategory; statusCode: number | null; summary: string | null; elapsedMs: number }
type ResolvedAddress = { address: string; family: number }
type LinkCheckDependencies = {
  resolve: (hostname: string) => Promise<ResolvedAddress>
  request: (url: URL, address: ResolvedAddress, timeoutMs: number) => Promise<{ statusCode: number; location?: string }>
}

function ipv4Number(value: string): number {
  return value.split('.').reduce((number, octet) => (number * 256 + Number(octet)) >>> 0, 0)
}

function inIpv4Range(address: string, network: string, prefix: number): boolean {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
  return (ipv4Number(address) & mask) === (ipv4Number(network) & mask)
}

function isPublicAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) {
    const blocked = [
      ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
      ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
      ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]
    ] as const
    return !blocked.some(([network, prefix]) => inIpv4Range(address, network, prefix))
  }
  if (family === 6) {
    const normalized = address.toLowerCase()
    if (normalized.startsWith('::ffff:') || normalized === '::' || normalized === '::1') return false
    const [firstPart, secondPart] = normalized.split(':')
    const first = Number.parseInt(firstPart || '0', 16)
    const second = Number.parseInt(secondPart || '0', 16)
    if ((first & 0xe000) !== 0x2000) return false
    if (first === 0x2001 && second <= 0x01ff) return false
    return !normalized.startsWith('2001:db8:') && !normalized.startsWith('2002:') && !normalized.startsWith('3fff:')
  }
  return false
}

export async function resolvePublic(hostname: string): Promise<ResolvedAddress> {
  const literalFamily = isIP(hostname.replace(/^\[|\]$/g, ''))
  const addresses = literalFamily
    ? [{ address: hostname.replace(/^\[|\]$/g, ''), family: literalFamily }]
    : await lookup(hostname, { all: true, verbatim: true })
  if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) throw new Error('UNSAFE_ADDRESS')
  return addresses[0]!
}

function requestHead(url: URL, address: ResolvedAddress, timeoutMs: number): Promise<{ statusCode: number; location?: string }> {
  return new Promise((resolve, reject) => {
    const secure = url.protocol === 'https:'
    const requestFn = secure ? https.request : http.request
    const hostname = address.address
    const headers = { Host: url.host, 'User-Agent': 'NavHub-LinkHealth/1.0', Accept: '*/*' }
    const request = requestFn({ hostname, family: address.family, port: url.port || (secure ? 443 : 80), path: `${url.pathname}${url.search}`, method: 'HEAD', headers, ...(secure && isIP(url.hostname) === 0 ? { servername: url.hostname } : {}), agent: false }, response => {
      resolve({ statusCode: response.statusCode ?? 0, location: Array.isArray(response.headers.location) ? response.headers.location[0] : response.headers.location })
      response.destroy()
    })
    request.setTimeout(timeoutMs, () => request.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })))
    request.once('error', reject)
    request.end()
  })
}

const dependencies: LinkCheckDependencies = {
  resolve: resolvePublic,
  request: requestHead
}

export async function checkLinkHealth(rawUrl: string, overrides: Partial<LinkCheckDependencies> = {}): Promise<LinkHealthResult> {
  const startedAt = Date.now()
  const finish = (result: Omit<LinkHealthResult, 'elapsedMs'>): LinkHealthResult => ({ ...result, elapsedMs: Math.max(0, Date.now() - startedAt) })
  const deps = { ...dependencies, ...overrides }
  let current: URL
  try {
    current = new URL(rawUrl)
    if (!['http:', 'https:'].includes(current.protocol) || current.username || current.password) return finish({ category: 'unsafe_target', statusCode: null, summary: '不支持的目标地址' })
  } catch { return finish({ category: 'unsafe_target', statusCode: null, summary: '目标地址无效' }) }
  const seen = new Set<string>()
  for (let redirectCount = 0; redirectCount <= 3; redirectCount++) {
    if (seen.has(current.href)) return finish({ category: 'redirect_error', statusCode: null, summary: '检测到重定向循环' })
    seen.add(current.href)
    let address: ResolvedAddress
    let dnsTimer: ReturnType<typeof setTimeout> | undefined
    try {
      address = await Promise.race([
        deps.resolve(current.hostname),
        new Promise<never>((_, reject) => { dnsTimer = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })), 5000) })
      ])
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
      if (error instanceof Error && error.message === 'UNSAFE_ADDRESS') return finish({ category: 'unsafe_target', statusCode: null, summary: '目标地址解析到受限网络' })
      if (code === 'ETIMEDOUT') return finish({ category: 'timeout', statusCode: null, summary: '域名解析超时' })
      return finish({ category: 'dns_error', statusCode: null, summary: '域名解析失败' })
    } finally { if (dnsTimer) clearTimeout(dnsTimer) }
    if (!isPublicAddress(address.address)) return finish({ category: 'unsafe_target', statusCode: null, summary: '目标地址解析到受限网络' })
    let response: { statusCode: number; location?: string }
    try { response = await deps.request(current, address, 5000) } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
      return finish({ category: code === 'ETIMEDOUT' ? 'timeout' : 'network_error', statusCode: null, summary: code === 'ETIMEDOUT' ? '请求超时' : '连接失败' })
    }
    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
      if (!response.location) return finish({ category: 'redirect_error', statusCode: response.statusCode, summary: '重定向缺少目标地址' })
      if (redirectCount === 3) return finish({ category: 'redirect_error', statusCode: response.statusCode, summary: '重定向次数超限' })
      try { current = new URL(response.location, current) } catch { return finish({ category: 'redirect_error', statusCode: response.statusCode, summary: '重定向地址无效' }) }
      if (!['http:', 'https:'].includes(current.protocol) || current.username || current.password) return finish({ category: 'unsafe_target', statusCode: response.statusCode, summary: '重定向目标不安全' })
      continue
    }
    return finish({ category: response.statusCode >= 200 && response.statusCode < 400 ? 'ok' : 'http_error', statusCode: response.statusCode, summary: response.statusCode >= 200 && response.statusCode < 400 ? null : '目标站返回错误状态' })
  }
  return finish({ category: 'redirect_error', statusCode: null, summary: '重定向次数超限' })
}
