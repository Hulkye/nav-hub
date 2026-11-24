import type { AdminContentCollection } from '../../../shared/schemas/admin-content'

export const enrichmentColumns = {
  resources: { platforms: 'platforms', version: 'version', screenshots: 'screenshots', downloadSources: 'download_sources', versionHistory: 'version_history' },
  media: { author: 'author', director: 'director', publisher: 'publisher', releaseDate: 'release_date', channels: 'channels' }
} as const

const jsonColumns = new Set(['platforms', 'screenshots', 'download_sources', 'version_history', 'channels'])

export function enrichmentValues(collection: AdminContentCollection, input: Record<string, unknown>): Array<{ column: string; value: unknown }> {
  if (collection !== 'resources' && collection !== 'media') return []
  return Object.entries(enrichmentColumns[collection]).map(([key, column]) => ({ column, value: jsonColumns.has(column) ? JSON.stringify(input[key] ?? []) : input[key] ?? (key === 'releaseDate' ? null : '') }))
}

export function enrichmentPublicFields(collection: AdminContentCollection): string {
  return collection === 'resources' || collection === 'media' ? Object.values(enrichmentColumns[collection]).join(', ') : ''
}
