import { z } from 'zod'
import { requireAdmin } from '../../../utils/auth'
import { getContentRepository } from '../../../utils/db'

const schema = z.object({ ids: z.array(z.string().uuid()).min(1).max(100), status: z.enum(['approved', 'rejected', 'spam', 'offline']), note: z.string().trim().max(1000).nullable().default(null) }).strict()

export default defineEventHandler(async event => {
  const admin = await requireAdmin(event)
  const input = schema.parse(await readBody(event))
  const repository = getContentRepository()
  const results: Array<{ id: string; status: string; error?: string }> = []
  for (const id of [...new Set(input.ids)]) {
    try {
      const result = input.status === 'offline'
        ? await repository.takeSubmissionOffline(id, input.note, admin.admin_id)
        : await repository.reviewSubmission(id, input.status, input.note, admin.admin_id)
      results.push(result ? { id, status: input.status } : { id, status: 'skipped', error: '投稿不存在、状态不匹配或已处理' })
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') results.push({ id, status: 'failed', error: 'Slug 或 URL 已存在' })
      else results.push({ id, status: 'failed', error: '处理失败，请打开单条投稿重试' })
    }
  }
  return { results }
})
