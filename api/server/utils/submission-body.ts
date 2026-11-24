import { readBody } from 'h3'
import type { H3Event } from 'h3'
import { limitUploadBody } from './upload-body'

export async function readBoundedSubmissionBody(event: H3Event) {
  await limitUploadBody(event, 256 * 1024)
  return readBody(event)
}
