import { requireAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event)
  return { username: session.username }
})
