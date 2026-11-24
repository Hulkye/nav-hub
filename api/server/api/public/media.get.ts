import { getPublicDirectoryRepository } from '../../utils/db'
import { parsePublicList } from '../../../../shared/schemas/public-list'

export default defineEventHandler(event => {
  let query
  try { query = parsePublicList('media', getQuery(event)) }
  catch { throw createError({ statusCode: 400, message: '书影音筛选参数无效' }) }
  return getPublicDirectoryRepository().list('media', query)
})
