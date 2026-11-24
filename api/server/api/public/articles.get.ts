import { getPublicDirectoryRepository } from '../../utils/db'
import { parsePublicList } from '../../../../shared/schemas/public-list'

export default defineEventHandler(event => {
  let query
  try { query = parsePublicList('articles', getQuery(event)) }
  catch { throw createError({ statusCode: 400, message: '文章筛选参数无效' }) }
  return getPublicDirectoryRepository().list('articles', query)
})
