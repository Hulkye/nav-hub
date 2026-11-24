import { rankingQuerySchema } from '../../repositories/rankings'
import { getRankingsRepository } from '../../utils/db'

export default defineEventHandler(async event => {
  const parsed = rankingQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: '榜单仅支持 7 天或 30 天' })
  return { days: parsed.data.days, items: await getRankingsRepository().list(parsed.data.days) }
})
