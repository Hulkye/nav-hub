import { z } from 'zod'
import { adminContentSchemas, type AdminContentCollection } from '#shared/schemas/admin-content'
import { requireAdmin } from '../../../utils/auth'
import { getContentRepository } from '../../../utils/db'

const schema = z.object({ ids: z.array(z.string().uuid()).min(1).max(100), status: z.enum(['draft', 'published', 'offline']) }).strict()
const collections = Object.keys(adminContentSchemas) as AdminContentCollection[]

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const collection = getRouterParam(event, 'collection') as AdminContentCollection
  if (!collections.includes(collection)) throw createError({ statusCode: 404, message: '内容类型不存在' })
  const input = schema.parse(await readBody(event))
  const updatedIds = await getContentRepository().bulkUpdateAdminContent(collection, input.ids, input.status, admin.admin_id)
  return { updated: updatedIds.length, ids: updatedIds }
})
