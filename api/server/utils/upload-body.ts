import { createError, getHeader, getRequestWebStream, type H3Event } from 'h3'

export async function limitUploadBody(event: H3Event, limit: number) {
  const declared = getHeader(event, 'content-length')
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit)) throw createError({ statusCode: 413, message: '上传请求超过大小限制' })
  const stream = getRequestWebStream(event)
  if (!stream) throw createError({ statusCode: 400, message: '上传内容为空' })
  const reader = stream.getReader()
  const chunks: Buffer[] = []
  let size = 0
  let oversized = false
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > limit) oversized = true
      else if (!oversized) chunks.push(Buffer.from(value))
    }
  } finally { reader.releaseLock() }
  if (oversized) throw createError({ statusCode: 413, message: '上传请求超过大小限制' })
  event._requestBody = Buffer.concat(chunks)
}
