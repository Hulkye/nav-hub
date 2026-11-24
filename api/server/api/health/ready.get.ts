import { getDatabase } from '../../utils/db'

export default defineEventHandler(async () => {
  try {
    const database = getDatabase()
    await database.execute('SELECT 1')
    return { status: 'ok', checks: { database: 'ok' } }
  } catch {
    throw createError({
      statusCode: 503,
      statusMessage: 'Service Unavailable',
      message: '服务尚未就绪',
      data: { code: 'SERVICE_NOT_READY' }
    })
  }
})
