import { z } from 'zod'
import { requireAdmin } from '../../utils/auth'
import { getContentRepository } from '../../utils/db'
import { checkLinkHealth } from '../../utils/link-health'

const schema = z.object({ ids: z.array(z.string().uuid()).min(1).max(100), retryFailed: z.boolean().default(false) }).strict()
type LinkCheckTask = { id: string; content_type: 'site' | 'resource' }
const workers = new Set<Promise<void>>()
const queue: LinkCheckTask[] = []

async function processRecord(record: LinkCheckTask) {
  const repository = getContentRepository()
  try {
    const target = await repository.getPublishedLinkTarget(record.content_type, record.id)
    const result = target ? await checkLinkHealth(target) : { category: 'unsafe_target' as const, statusCode: null, summary: '内容已下线或目标地址不可用', elapsedMs: 0 }
    await repository.finishLinkHealthCheck(record.content_type, record.id, result)
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'UNKNOWN'
    console.error('[link-health] failed to process check', { contentType: record.content_type, id: record.id, code })
    try { await repository.failQueuedLinkHealthCheck(record.content_type, record.id, '检查任务未能完成') } catch (saveError) {
      console.error('[link-health] failed to save check result', { contentType: record.content_type, id: record.id, name: saveError instanceof Error ? saveError.name : 'UNKNOWN' })
    }
  }
}

async function drainQueue() {
  while (queue.length) await processRecord(queue.shift()!)
}

function schedule(records: LinkCheckTask[]) {
  queue.push(...records)
  while (workers.size < 4 && queue.length) {
    const task = drainQueue().finally(() => {
      workers.delete(task)
      if (queue.length) schedule([])
    })
    workers.add(task)
  }
}

export default defineEventHandler(async event => {
  const admin = await requireAdmin(event)
  const input = schema.parse(await readBody(event))
  const repository = getContentRepository()
  if (queue.length + workers.size >= 500) throw createError({ statusCode: 503, message: '检查队列繁忙，请稍后重试' })
  const records = await repository.beginLinkHealthCheck(input.ids, admin.admin_id, input.retryFailed)
  schedule(records as LinkCheckTask[])
  return { queued: records.length, active: workers.size }
})
