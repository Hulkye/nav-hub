import { getContentRepository } from '../../../utils/db'

export default defineEventHandler(async () => ({ categories: await getContentRepository().listPublicCategories() }))
