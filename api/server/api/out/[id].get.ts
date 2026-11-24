import { getContentRepository } from '../../utils/db'
import { publicEventDedupeKey } from '../../utils/public-events'
import { contentIdSchema } from '#shared/schemas/admin-content'

export default defineEventHandler(async event => {
  const parsed = contentIdSchema.safeParse(getRouterParam(event, 'id'))
  if (!parsed.success) throw createError({ statusCode: 404, message: '外链不存在或暂不可访问' })
  const id = parsed.data
  const repository = getContentRepository()
  const target = await repository.getOutboundTarget(id ?? '')
  if (!target) throw createError({ statusCode: 404, message: '外链不存在或暂不可访问' })
  try { await repository.recordPublicEvent('outbound_click', target.content_type, target.id, publicEventDedupeKey(event)) } catch (error) { console.error('[analytics] failed to record outbound click', error) }
  return sendRedirect(event, target.target_url, 302)
})
