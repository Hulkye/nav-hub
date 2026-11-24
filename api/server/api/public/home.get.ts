import { getPublicDirectoryRepository, getHomepageRepository } from '../../utils/db'

export default defineEventHandler(async () => ({
  modules: await getHomepageRepository().renderHomepageModules(),
  ...await getPublicDirectoryRepository().homepageCategories()
}))
