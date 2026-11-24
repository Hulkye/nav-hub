import { reportSchema } from '../../../../shared/schemas/content'
import { getContentRepository } from '../../utils/db'
import { publicLimitKey } from '../../utils/public-client-ip'
import { assertSameOrigin } from '../../utils/auth'

export default defineEventHandler(async event => {
  assertSameOrigin(event)
  const repository = getContentRepository()
  if (!await repository.consumePublicLimit(publicLimitKey(event, 'report'))) {
    setResponseHeader(event, 'Retry-After', 900)
    throw createError({ statusCode: 429, message: '提交过于频繁，请稍后再试', data: { code: 'RATE_LIMITED' } })
  }
  const parsed = reportSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: '举报字段无效，请检查原因、内容 ID、说明长度和邮箱格式', data: { code: 'INVALID_REPORT' } })
  const input = parsed.data
  const clientHash = publicLimitKey(event, 'report').slice('report:'.length)
  try { await repository.createReport(input, clientHash) }
  catch (error) {
    if (error instanceof Error && error.message === 'REPORT_TARGET_NOT_FOUND') throw createError({ statusCode: 404, message: '举报目标不存在或暂未公开' })
    throw error
  }
  return { accepted: true, message: '举报已提交，管理员会尽快处理。' }
})
