import { createHash } from 'node:crypto'
import { isIP } from 'node:net'
import { getHeader, type H3Event } from 'h3'

function normalizeIp(value: string): string | undefined {
  const ip = value.trim()
  if (!isIP(ip)) return undefined
  if (ip.toLowerCase().startsWith('::ffff:') && isIP(ip.slice(7)) === 4) return ip.slice(7)
  return isIP(ip) === 6 ? new URL(`http://[${ip}]/`).hostname.slice(1, -1) : ip
}

// Trust only explicitly configured proxy IPs, walking XFF from the socket inward.
// A caller-supplied leftmost entry must never override the first untrusted hop.
export function resolvePublicClientIp(remoteAddress: string | undefined, forwardedFor: string | undefined, trustedProxyIps = ''): string {
  const remote = remoteAddress && normalizeIp(remoteAddress)
  if (!remote) return 'unknown'
  const trusted = new Set(trustedProxyIps.split(',').map(normalizeIp).filter(Boolean))
  if (!trusted.has(remote) || !forwardedFor) return remote
  const chain = forwardedFor.split(',').map(normalizeIp)
  if (chain.some(ip => !ip)) return remote
  let client = remote
  for (let index = chain.length - 1; index >= 0 && trusted.has(client); index--) client = chain[index]!
  return client
}

export function publicLimitKey(event: H3Event, action: 'submission' | 'comment' | 'report' | 'submission-status' | 'submission-edit'): string {
  const config = useRuntimeConfig(event)
  const ip = resolvePublicClientIp(event.node.req.socket?.remoteAddress, getHeader(event, 'x-forwarded-for'), config.trustedProxyIps)
  return `${action}:${createHash('sha256').update(ip).digest('hex')}`
}
