import type { H3Event } from 'h3'
import { assertSameOrigin } from './auth'
import { getContentRepository } from './db'
import { publicLimitKey } from './public-client-ip'
import { SubmissionError } from '../repositories/submission-receipts'

export async function protectSubmissionRequest(event: H3Event, action: 'submission' | 'submission-status' | 'submission-edit') {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  setResponseHeader(event, 'X-Robots-Tag', 'noindex, nofollow')
  assertSameOrigin(event)
  if (!await getContentRepository().consumePublicLimit(publicLimitKey(event, action))) {
    setResponseHeader(event, 'Retry-After', 900)
    throw createError({ statusCode: 429, message: '请求过于频繁，请稍后再试', data: { code: 'RATE_LIMITED' } })
  }
}

export async function submissionResult<T>(operation: () => Promise<T>) {
  try { return await operation() } catch (error) {
    if (!(error instanceof SubmissionError)) throw error
    const missing = error.code === 'RECEIPT_NOT_FOUND'
    throw createError({ statusCode: missing ? 404 : 409, message: missing ? '回执无效或不存在' : error.code === 'DUPLICATE_PUBLISHED_URL' ? '该地址已公开收录，请勿重复投稿' : '当前投稿不可修改', data: { code: error.code } })
  }
}
