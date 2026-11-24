import { createHash, randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'
import { getAuthRepository } from './db'

export const SESSION_COOKIE = 'navhub_admin'
export const SESSION_MAX_AGE = 60 * 60 * 8

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function createSessionToken() {
  return randomBytes(32).toString('hex')
}

export function assertSameOrigin(event: H3Event) {
  const siteOrigin = new URL(useRuntimeConfig(event).public.siteUrl).origin
  if (getHeader(event, 'origin') !== siteOrigin) {
    throw createError({ statusCode: 403, message: '请求来源不受信任', data: { code: 'INVALID_ORIGIN' } })
  }
}

export async function requireAdmin(event: H3Event) {
  const token = getCookie(event, SESSION_COOKIE)
  const session = token && /^[a-f0-9]{64}$/.test(token)
    ? await getAuthRepository().getSession(hashToken(token))
    : undefined
  if (!session) throw createError({ statusCode: 401, message: '请先登录管理台', data: { code: 'UNAUTHENTICATED' } })
  return session
}

export function sessionCookieOptions(event: H3Event) {
  return {
    httpOnly: true,
    secure: new URL(useRuntimeConfig(event).public.siteUrl).protocol === 'https:',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE
  }
}
