import { categorySchema } from '#shared/schemas/content'
import { requireAdmin } from '../../../utils/auth'
import { getContentRepository } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const input = categorySchema.parse(await readBody(event))
  const repository = getContentRepository()
  try {
    const category = await repository.createCategory(input)
    await repository.audit(admin.admin_id, 'create', 'category', String(category?.id))
    setResponseStatus(event, 201)
    return category
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') throw createError({ statusCode: 409, message: 'Slug 已被使用', data: { code: 'DUPLICATE_SLUG' } })
    throw error
  }
})
