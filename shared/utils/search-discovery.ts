export const searchHistoryKey = 'navhub.search.history.v1'
export const normalizeSearchTerm = (term: string) => term.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()

export function readSearchHistory(raw: string | null): string[] {
  try {
    const value: unknown = JSON.parse(raw ?? '[]')
    return Array.isArray(value) ? [...new Set(value.filter((term): term is string => typeof term === 'string' && term.trim().length >= 2 && term.length <= 120).map(normalizeSearchTerm))].slice(0, 10) : []
  } catch { return [] }
}

export function addSearchHistory(history: string[], term: string): string[] {
  return readSearchHistory(JSON.stringify([term, ...history]))
}

const synonyms = [['js', 'javascript'], ['ts', 'typescript'], ['postgres', 'postgresql'], ['人工智能', 'ai'], ['文档', 'documentation'], ['图标', 'icons']]

// A single edit (including transposition), restricted to short Latin words.
export function isSearchTypo(a: string, b: string): boolean {
  if (!/^[a-z]{4,32}$/.test(a) || !/^[a-z]{4,32}$/.test(b) || Math.abs(a.length - b.length) > 1 || a === b) return false
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === b[i]) continue
    if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2))
    return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1)
  }
  return true
}

export function searchAlternatives(query: string, titles: string[]): string[] {
  const term = normalizeSearchTerm(query)
  const aliases = synonyms.find(group => group.includes(term))?.filter(alias => alias !== term) ?? []
  const words = titles.flatMap(title => normalizeSearchTerm(title).match(/[a-z]{4,32}/g) ?? [])
  return [...new Set([...aliases, ...words.filter(word => isSearchTypo(term, word))])].slice(0, 3)
}
