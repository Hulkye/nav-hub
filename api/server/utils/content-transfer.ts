import { adminContentSchemas, type AdminContentCollection } from '../../../shared/schemas/admin-content'
import { siteSchema } from '../../../shared/schemas/content'

export type ContentTransferCollection = AdminContentCollection | 'sites'

const exportFields: Record<ContentTransferCollection, Array<[string, string]>> = {
  sites: [['title', 'title'], ['slug', 'slug'], ['description', 'description'], ['body', 'body'], ['target_url', 'targetUrl'], ['backup_url', 'backupUrl'], ['preview_url', 'previewUrl'], ['icon_url', 'iconUrl'], ['sort_order', 'sortOrder'], ['category_ids', 'categoryIds'], ['tag_ids', 'tagIds'], ['status', 'status']],
  resources: [['title', 'title'], ['slug', 'slug'], ['description', 'description'], ['resource_type', 'resourceType'], ['cover_url', 'coverUrl'], ['target_url', 'targetUrl'], ['tag_ids', 'tagIds'], ['status', 'status']],
  media: [['title', 'title'], ['slug', 'slug'], ['description', 'description'], ['media_type', 'mediaType'], ['cover_url', 'coverUrl'], ['rating', 'rating'], ['tag_ids', 'tagIds'], ['status', 'status']],
  articles: [['title', 'title'], ['slug', 'slug'], ['summary', 'summary'], ['body', 'body'], ['cover_url', 'coverUrl'], ['tag_ids', 'tagIds'], ['status', 'status']],
  announcements: [['title', 'title'], ['body', 'body'], ['target_url', 'targetUrl'], ['starts_at', 'startsAt'], ['ends_at', 'endsAt'], ['tag_ids', 'tagIds'], ['status', 'status']]
}
const enrichmentTransferFields: Partial<Record<ContentTransferCollection, Array<[string, string]>>> = {
  resources: [['platforms', 'platforms'], ['version', 'version'], ['screenshots', 'screenshots'], ['download_sources', 'downloadSources'], ['version_history', 'versionHistory']],
  media: [['author', 'author'], ['director', 'director'], ['publisher', 'publisher'], ['release_date', 'releaseDate'], ['channels', 'channels']]
}
for (const collection of ['resources', 'media'] as const) exportFields[collection].push(...enrichmentTransferFields[collection]!)
const jsonTransferFields = new Set(['platforms', 'screenshots', 'download_sources', 'version_history', 'channels'])

export function whitelistExport(collection: ContentTransferCollection, rows: Array<Record<string, unknown>>) {
  return rows.map(row => Object.fromEntries(exportFields[collection].filter(([field]) => field in row).map(([field, key]) => [key, field === 'release_date' && row[field] instanceof Date ? row[field].toISOString().slice(0, 10) : row[field]])))
}

export function csvCell(value: unknown): string {
  let text = value == null ? '' : Array.isArray(value) ? value.map(item => typeof item === 'string' ? item : JSON.stringify(item)).join('|') : typeof value === 'object' ? JSON.stringify(value) : String(value)
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

export function csvExport(collection: ContentTransferCollection, rows: Array<Record<string, unknown>>) {
  const safe = whitelistExport(collection, rows)
  const fields = exportFields[collection]
  return [fields.map(([field]) => csvCell(field)).join(','), ...safe.map(row => fields.map(([field, key]) => csvCell(jsonTransferFields.has(field) ? JSON.stringify(row[key] ?? []) : row[key])).join(','))].join('\r\n')
}

export function importTemplate(collection: ContentTransferCollection) {
  const common = { title: '示例内容', slug: 'example-content', status: 'draft', tagIds: [] }
  const samples = {
    sites: { ...common, targetUrl: 'https://example.com/', categoryIds: [] },
    resources: { ...common, targetUrl: 'https://example.com/', resourceType: 'software' },
    media: { ...common, mediaType: 'book' },
    articles: { ...common, body: '请替换为正文' },
    announcements: { title: '示例公告', body: '请替换为公告正文', tagIds: [], status: 'draft' }
  }
  return samples[collection]
}

export function validateImportRow(collection: ContentTransferCollection, raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { success: false as const, errors: ['内容行必须是对象'] }
  const { status: _ignoredStatus, ...row } = raw as Record<string, unknown>
  const parsed = (collection === 'sites' ? siteSchema : adminContentSchemas[collection]).safeParse({ ...row, status: 'draft' })
  if (!parsed.success) return { success: false as const, errors: parsed.error.issues.map(issue => `${issue.path.join('.') || 'row'}: ${issue.message}`) }
  return { success: true as const, data: parsed.data }
}

export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  text = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  let closedQuote = false
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index++ }
      else if (char === '"') { quoted = false; closedQuote = true }
      else cell += char
    } else if (char === '"' && cell.length === 0) quoted = true
    else if (char === ',') { row.push(cell); cell = ''; closedQuote = false }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index++
      row.push(cell); cell = ''
      if (row.some(value => value.length)) rows.push(row)
      row = []; closedQuote = false
    } else {
      if (closedQuote || char === '"') throw new Error('CSV_INVALID_QUOTE')
      cell += char
    }
    if (row.length > 32 || cell.length > 50000) throw new Error('CSV_LIMIT_EXCEEDED')
  }
  if (quoted) throw new Error('CSV_UNCLOSED_QUOTE')
  if (cell.length || row.length) { row.push(cell); if (row.some(value => value.length)) rows.push(row) }
  const headers = rows.shift() ?? []
  if (!headers.length || headers.length > 32 || new Set(headers).size !== headers.length) throw new Error('CSV_INVALID_HEADER')
  if (rows.some(row => row.length !== headers.length)) throw new Error('CSV_INVALID_ROW_SHAPE')
  return { headers, rows }
}

const csvImportFields: Record<ContentTransferCollection, string[]> = {
  sites: ['title', 'slug', 'description', 'body', 'target_url', 'backup_url', 'preview_url', 'icon_url', 'sort_order', 'category_ids', 'tag_ids', 'status'],
  resources: ['title', 'slug', 'description', 'target_url', 'resource_type', 'cover_url', 'tag_ids', 'status'],
  media: ['title', 'slug', 'description', 'media_type', 'cover_url', 'rating', 'tag_ids', 'status'],
  articles: ['title', 'slug', 'summary', 'body', 'cover_url', 'tag_ids', 'status'],
  announcements: ['title', 'body', 'target_url', 'starts_at', 'ends_at', 'tag_ids', 'status']
}
for (const collection of ['resources', 'media'] as const) csvImportFields[collection].push(...enrichmentTransferFields[collection]!.map(([field]) => field))

export function csvImportRows(collection: ContentTransferCollection, text: string): unknown[] {
  const parsed = parseCsv(text)
  const allowed = new Set(csvImportFields[collection])
  if (parsed.headers.some(header => !allowed.has(header))) throw new Error('CSV_UNKNOWN_FIELD')
  if (!parsed.headers.includes('title')) throw new Error('CSV_TITLE_REQUIRED')
  return parsed.rows.map(row => Object.fromEntries(parsed.headers.map((header, index) => {
    const value = row[index] ?? ''
    if (jsonTransferFields.has(header)) return [header.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase()), value ? JSON.parse(value) : []]
    if (header === 'release_date') return ['releaseDate', value ? value.slice(0, 10) : null]
    if (header === 'tag_ids' || header === 'category_ids') return [header === 'tag_ids' ? 'tagIds' : 'categoryIds', value ? value.split('|').filter(Boolean) : []]
    if (header === 'sort_order') return [header.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase()), value === '' ? 0 : Number(value)]
    if (header === 'rating') return [header, value === '' ? null : Number(value)]
    if (['cover_url', 'target_url', 'backup_url', 'preview_url', 'icon_url'].includes(header)) return [header.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase()), value || null]
    if (['starts_at', 'ends_at'].includes(header)) {
      const date = value ? new Date(value) : null
      return [header.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase()), date && !Number.isNaN(date.getTime()) ? date.toISOString() : value || null]
    }
    const camel = header.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase())
    return [camel, value]
  })))
}
