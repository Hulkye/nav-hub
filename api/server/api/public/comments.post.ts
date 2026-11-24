import { commentSchema } from '../../../../shared/schemas/content'
import { getContentRepository } from '../../utils/db'
import { publicLimitKey } from '../../utils/public-client-ip'

export default defineEventHandler(async event => {
  const repository = getContentRepository()
  if (!(await repository.consumePublicLimit(publicLimitKey(event, 'comment')))) {
    setResponseHeader(event, 'Retry-After', 900)
    throw createError({ statusCode: 429, message: '提交过于频繁，请稍后再试', data: { code: 'RATE_LIMITED' } })
  }
  const input = commentSchema.parse(await readBody(event))
  let comment
  try {
    comment = await repository.createComment(input)
  } catch (error) {
    if (error instanceof Error && error.message === 'COMMENT_TARGET_NOT_FOUND')
      throw createError({ statusCode: 404, message: '评论目标不存在', data: { code: 'COMMENT_TARGET_NOT_FOUND' } })
    throw error
  }
  return { accepted: true, id: comment?.id, message: '评论已提交，审核通过后显示。' }
})
