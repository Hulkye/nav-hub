import { getHomepageRepository } from '../../utils/db'

export default defineEventHandler(async () => ({ settings: await getHomepageRepository().getSiteSettings() }))
