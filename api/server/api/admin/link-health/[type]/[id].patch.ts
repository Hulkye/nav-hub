import { z } from 'zod'
import { requireAdmin } from '../../../../utils/auth'
import { getContentRepository } from '../../../../utils/db'

const typeSchema = z.enum(['sites', 'resources'])
const bodySchema = z.object({ ignored: z.boolean() }).strict()
export default defineEventHandler(async event => {
  const admin = await requireAdmin(event)
  const type = typeSchema.parse(getRouterParam(event, 'type'))
  const id = getRouterParam(event, 'id')!
  const input = bodySchema.parse(await readBody(event))
  const changed = await getContentRepository().setLinkHealthIgnored(type === 'sites' ? 'site' : 'resource', id, input.ignored, admin.admin_id)
  if (!changed) throw createError({ statusCode: 404, message: '已发布内容不存在' })
  return { updated: true }
})
