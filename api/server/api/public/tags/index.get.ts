import { getDiscoveryRepository } from '../../../utils/db'

export default defineEventHandler(() => getDiscoveryRepository().listTags())
