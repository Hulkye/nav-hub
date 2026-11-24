import { z } from 'zod'
import { requireAdmin } from '../../../utils/auth'
import { getContentRepository } from '../../../utils/db'

const host = z.string().trim().min(1).max(253).regex(/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i)
const schema = z.object({ ids: z.array(z.string().uuid()).min(1).max(100), oldHost: host, newHost: host }).strict().refine(input => input.oldHost.toLowerCase() !== input.newHost.toLowerCase(), { message: '新旧域名不能相同' })
export default defineEventHandler(async event => {
  const admin = await requireAdmin(event)
  const input = schema.parse(await readBody(event))
  try { return await getContentRepository().replaceSiteDomains(input.ids, input.oldHost, input.newHost, admin.admin_id) }
  catch (error) {
    if (error instanceof Error && error.message === 'SITES_NOT_FOUND') throw createError({ statusCode: 404, message: '部分网站不存在，请刷新列表后重试' })
    throw error
  }
})
