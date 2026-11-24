import { z } from 'zod'
import type { H3Event } from 'h3'
import { adminContentSchemas, contentIdSchema, type AdminContentCollection } from '#shared/schemas/admin-content'
import { getQuery } from 'h3'
import { requireAdmin } from './auth'
import { getContentRepository } from './db'

function validate<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw)
  if (!result.success) throw createError({ statusCode: 400, message: result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ') })
  return result.data
}

export async function handleImageReferenceError<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation() } catch (error) {
    if (error && typeof error === 'object' && 'constraint' in error && error.constraint === 'image_asset_reference_exists') {
      throw createError({ statusCode: 409, message: '引用的图片已被删除，请重新选择图片后保存' })
    }
    throw error
  }
}

export async function handleAdminContent(event: H3Event, collection: AdminContentCollection, action: 'list' | 'get' | 'create' | 'update' | 'delete') {
  const admin = await requireAdmin(event)
  const repository = getContentRepository()
  if (action === 'list') {
    const query = getQuery(event)
    try {
      return { [collection]: await repository.listAdminContent(collection, { page: query.page, pageSize: query.pageSize, status: query.status, q: query.q }) }
    } catch (error) {
      if (error instanceof z.ZodError) throw createError({ statusCode: 400, message: '筛选或分页参数无效', data: { code: 'INVALID_QUERY' } })
      throw error
    }
  }
  const id = action === 'create' ? undefined : validate(contentIdSchema, getRouterParam(event, 'id'))
  if (action === 'get') {
    const item = await repository.getAdminContent(collection, id!)
    if (!item) throw createError({ statusCode: 404, message: '内容不存在' })
    return item
  }
  const input = action === 'delete' ? undefined : validate(adminContentSchemas[collection] as z.ZodType, await readBody(event))
  let result
  try {
    result = action === 'create' ? await repository.createAdminContent(collection, input)
      : action === 'update' ? await repository.updateAdminContent(collection, id!, input)
        : await repository.deleteAdminContent(collection, id!)
  } catch (error) {
    if (error && typeof error === 'object' && 'constraint' in error && error.constraint === 'image_asset_reference_exists') {
      throw createError({ statusCode: 409, message: '引用的图片已被删除，请重新选择图片后保存' })
    }
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      throw createError({ statusCode: 409, message: 'Slug 已存在，请使用其他值' })
    }
    throw error
  }
  if (!result) throw createError({ statusCode: 404, message: '内容不存在' })
  await repository.audit(admin.admin_id, action, collection, String((result as Record<string, unknown>).id))
  if (action === 'create') setResponseStatus(event, 201)
  return action === 'delete' ? { deleted: true } : result
}
