import { getSubmissionNotificationsRepository } from '../../../utils/db'

export default defineEventHandler(async () => getSubmissionNotificationsRepository().list())
