import { getContentRepository } from '../../utils/db'

export default defineEventHandler(async () => ({ sites: await getContentRepository().listSites(true) }))
