import { tagSchema } from '#shared/schemas/content'
import { requireAdmin } from '../../../utils/auth'
import { getContentRepository } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const id = getRouterParam(event, 'id')!
  const input = tagSchema.parse(await readBody(event))
  try {
    const repository = getContentRepository()
    const tag = await repository.updateTag(id, input)
    if (!tag) throw createError({ statusCode: 404, message: '标签不存在', data: { code: 'TAG_NOT_FOUND' } })
    await repository.audit(admin.admin_id, 'update', 'tag', id)
    return tag
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') throw createError({ statusCode: 409, message: 'Slug 已被使用', data: { code: 'DUPLICATE_SLUG' } })
    throw error
  }
})
