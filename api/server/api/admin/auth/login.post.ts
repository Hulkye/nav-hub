import { adminLoginSchema } from '../../../../../shared/schemas/admin'
import { createSessionToken, hashToken, SESSION_COOKIE, SESSION_MAX_AGE, sessionCookieOptions } from '../../../utils/auth'
import { getAuthRepository } from '../../../utils/db'
import { hashPassword, verifyPassword } from '../../../utils/password'

const dummyHash = hashPassword('timing-only-dummy-password')

export default defineEventHandler(async (event) => {
  const repository = getAuthRepository()
  const ip = getRequestIP(event) ?? 'unknown'
  if (!await repository.consumeLoginAttempt(hashToken(ip))) {
    setResponseHeader(event, 'Retry-After', 900)
    throw createError({ statusCode: 429, message: '尝试次数过多，请稍后重试', data: { code: 'LOGIN_RATE_LIMITED' } })
  }
  const parsed = adminLoginSchema.safeParse(await readBody<unknown>(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: '账号或密码格式不正确', data: { code: 'INVALID_INPUT' } })
  const admin = await repository.findAdmin(parsed.data.username)
  const valid = await verifyPassword(parsed.data.password, admin?.password_hash ?? await dummyHash)
  if (!admin || !valid) {
    await repository.audit(null, 'login_failed')
    throw createError({ statusCode: 401, message: '账号或密码不正确', data: { code: 'INVALID_CREDENTIALS' } })
  }
  const previous = getCookie(event, SESSION_COOKIE)
  if (previous) await repository.revokeSession(hashToken(previous))
  const token = createSessionToken()
  await repository.createSession(admin.id, hashToken(token), new Date(Date.now() + SESSION_MAX_AGE * 1000))
  await repository.audit(admin.id, 'login_succeeded')
  setCookie(event, SESSION_COOKIE, token, sessionCookieOptions(event))
  return { username: admin.username }
})
