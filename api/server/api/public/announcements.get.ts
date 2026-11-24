import { getContentRepository } from '../../utils/db'

export default defineEventHandler(() => getContentRepository().listPublishedContent('announcements'))
