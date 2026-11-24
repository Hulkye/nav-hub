import { z } from 'zod'
import { requireAdmin } from '../../../utils/auth'
import { getContentRepository } from '../../../utils/db'

const orderSchema = z.object({ items: z.array(z.object({ id: z.string().uuid(), sortOrder: z.number().int().min(0).max(999999) }).strict()).min(1).max(500) }).strict()

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const input = orderSchema.parse(await readBody(event))
  const repository = getContentRepository()
  const updated = await repository.reorderCategories(input.items, admin.admin_id)
  return { updated }
})
