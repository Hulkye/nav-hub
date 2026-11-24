import { getSubmissionReceiptsRepository } from '../../utils/db'
import { protectSubmissionRequest, submissionResult } from '../../utils/guest-submission'

export default defineEventHandler(async (event) => {
  await protectSubmissionRequest(event, 'submission')
  const body = await readBoundedSubmissionBody(event)
  return submissionResult(() => getSubmissionReceiptsRepository().submit(body))
})
