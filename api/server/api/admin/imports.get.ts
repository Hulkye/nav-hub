import { requireAdmin } from '../../utils/auth'
import { getContentRepository } from '../../utils/db'

const collections = ['sites', 'resources', 'media', 'articles', 'announcements'] as const
const labels = { sites: '网站', resources: '资源', media: '媒体', articles: '文章', announcements: '公告' } as const
type ImportBatch = { id: string; total_rows: number; imported_rows: number; rejected_rows: number; created_at: string; row_results: unknown }

export default defineEventHandler(async event => {
  await requireAdmin(event)
  const repository = getContentRepository()
  const batches = await Promise.all(collections.map(async collection =>
    (await repository.listImportBatches(collection) as ImportBatch[]).map(batch => ({ ...batch, collection, collection_label: labels[collection] }))
  ))
  return { batches: batches.flat().sort((left, right) => new Date(String(right.created_at)).getTime() - new Date(String(left.created_at)).getTime()) }
})
