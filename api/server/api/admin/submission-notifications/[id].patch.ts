import { z } from 'zod'
import { requireAdmin } from '../../../utils/auth'
import { getSubmissionNotificationsRepository } from '../../../utils/db'

export default defineEventHandler(async event => {
  const admin = await requireAdmin(event)
  const id = z.string().uuid().parse(getRouterParam(event, 'id'))
  const result = await getSubmissionNotificationsRepository().handle(id, admin.admin_id)
  if (!result) throw createError({ statusCode: 404, message: '通知不存在或已处理' })
  return result
})
