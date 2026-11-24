import { getPublicDirectoryRepository } from '../../../utils/db'
import { parsePublicList } from '../../../../../shared/schemas/public-list'

export default defineEventHandler(async (event) => {
  let query
  try { query = parsePublicList('sites', getQuery(event)) }
  catch { throw createError({ statusCode: 400, message: '分类筛选参数无效' }) }
  const category = await getPublicDirectoryRepository().category(getRouterParam(event, 'slug')!, query)
  if (!category) throw createError({ statusCode: 404, message: '分类不存在', data: { code: 'CATEGORY_NOT_FOUND' } })
  return category
})
