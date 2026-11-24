import { z } from 'zod'
import { requireAdmin } from '../../../utils/auth'
import { getContentRepository } from '../../../utils/db'

const schema = z.object({ status: z.enum(['approved', 'rejected', 'spam', 'offline']), note: z.string().trim().max(1000).nullable().default(null), payload: z.record(z.string(), z.unknown()).optional(), categoryIds: z.array(z.string().uuid()).max(20).default([]), tagIds: z.array(z.string().uuid()).max(50).default([]) }).strict()
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const input = schema.parse(await readBody(event))
  if (input.categoryIds.length && input.payload && !('targetUrl' in input.payload && 'description' in input.payload)) throw createError({ statusCode: 400, message: '仅网站投稿可分配分类' })
  let result
  try {
    result = input.status === 'offline'
      ? await getContentRepository().takeSubmissionOffline(getRouterParam(event, 'id')!, input.note, admin.admin_id)
      : await getContentRepository().reviewSubmission(getRouterParam(event, 'id')!, input.status, input.note, admin.admin_id, input.payload, input.categoryIds, input.tagIds)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') throw createError({ statusCode: 409, message: 'Slug 或 URL 已存在，请修订投稿后重试', data: { code: 'SUBMISSION_CONFLICT' } })
    throw error
  }
  if (!result) throw createError({ statusCode: 409, message: '申请不存在或已审核', data: { code: 'SUBMISSION_ALREADY_REVIEWED' } })
  return result
})
