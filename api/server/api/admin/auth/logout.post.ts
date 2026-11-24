import { hashToken, requireAdmin, SESSION_COOKIE, sessionCookieOptions } from '../../../utils/auth'
import { getAuthRepository } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event)
  const token = getCookie(event, SESSION_COOKIE)!
  const repository = getAuthRepository()
  await repository.revokeSession(hashToken(token))
  await repository.audit(session.admin_id, 'logout', session.id)
  deleteCookie(event, SESSION_COOKIE, sessionCookieOptions(event))
  return { success: true }
})
