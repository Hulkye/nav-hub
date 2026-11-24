import { categorySchema } from '#shared/schemas/content'
import { requireAdmin } from '../../../utils/auth'
import { getContentRepository } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const id = getRouterParam(event, 'id')!
  const input = categorySchema.parse(await readBody(event))
  try {
    const repository = getContentRepository()
    const category = await repository.updateCategory(id, input)
    if (!category) throw createError({ statusCode: 404, message: '分类不存在', data: { code: 'CATEGORY_NOT_FOUND' } })
    await repository.audit(admin.admin_id, 'update', 'category', id)
    return category
  } catch (error) {
    if (error instanceof Error && error.message === 'CATEGORY_PARENT_CYCLE') throw createError({ statusCode: 400, message: '不能将分类设为自身或后代的子分类', data: { code: error.message } })
    if (error instanceof Error && error.message === 'CATEGORY_PARENT_NOT_FOUND') throw createError({ statusCode: 400, message: '父分类不存在', data: { code: error.message } })
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') throw createError({ statusCode: 409, message: 'Slug 已被使用', data: { code: 'DUPLICATE_SLUG' } })
    throw error
  }
})
