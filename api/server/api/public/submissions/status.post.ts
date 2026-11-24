import { z } from 'zod'
import { getSubmissionReceiptsRepository } from '../../../utils/db'
import { protectSubmissionRequest, submissionResult } from '../../../utils/guest-submission'

export default defineEventHandler(async event => {
  await protectSubmissionRequest(event, 'submission-status')
  const body = z.object({ receipt: z.unknown() }).strict().parse(await readBoundedSubmissionBody(event))
  return submissionResult(() => getSubmissionReceiptsRepository().status(body.receipt))
})
