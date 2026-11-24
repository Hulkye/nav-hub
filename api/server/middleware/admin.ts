import { assertSameOrigin, requireAdmin } from '../utils/auth'

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (path !== '/api/admin' && !path.startsWith('/api/admin/')) return
  setResponseHeader(event, 'Cache-Control', 'no-store')
  setResponseHeader(event, 'X-Robots-Tag', 'noindex, nofollow')
  if (!['GET', 'HEAD', 'OPTIONS'].includes(event.method)) assertSameOrigin(event)
  if (path === '/api/admin/auth/login' && event.method === 'POST') return
  await requireAdmin(event)
})
