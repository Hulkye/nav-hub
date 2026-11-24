import { handleAdminContent } from '../../../utils/admin-content'

export default defineEventHandler(event => handleAdminContent(event, 'resources', 'delete'))
