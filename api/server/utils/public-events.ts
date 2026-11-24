import { createHash } from 'node:crypto'
import { getHeader, type H3Event } from 'h3'
import { publicLimitKey } from './public-client-ip'

export function publicEventDedupeKey(event: H3Event): string {
  const bucket = Math.floor(Date.now() / (10 * 60 * 1000))
  return createHash('sha256').update(`${publicLimitKey(event, 'comment')}:${getHeader(event, 'user-agent') ?? ''}:${bucket}`).digest('hex')
}
