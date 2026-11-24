import { requireAdmin } from '../../../../utils/auth'
import { getPublicDirectoryRepository } from '../../../../utils/db'

export default defineEventHandler(async event => {
  await requireAdmin(event)
  const result = await getPublicDirectoryRepository().listCategorySites(getRouterParam(event, 'id')!)
  if (!result) throw createError({ statusCode: 404, message: '分类不存在' })
  return result
})
