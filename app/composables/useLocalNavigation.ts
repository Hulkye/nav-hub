import { navigationKeys, parseNavigation, prependNavigation, type LocalNavigationItem, type NavigationKind } from '#shared/utils/local-navigation'

export function useLocalNavigation() {
  const favorites = useState<LocalNavigationItem[]>('local-favorites', () => [])
  const recent = useState<LocalNavigationItem[]>('local-recent', () => [])
  const ready = ref(false)
  const storageError = ref('')
  function init() {
    if (!import.meta.client) return
    storageError.value = ''
    try {
      favorites.value = parseNavigation(localStorage.getItem(navigationKeys.favorites), 'favorites')
      recent.value = parseNavigation(localStorage.getItem(navigationKeys.recent), 'recent')
    } catch { storageError.value = '无法读取本地导航，存储可能已损坏或被浏览器禁用。可清空记录后重试。' }
    ready.value = true
  }
  function save(kind: NavigationKind, items: LocalNavigationItem[]) {
    if (!import.meta.client) return
    try {
      localStorage.setItem(navigationKeys[kind], JSON.stringify(items))
      ;(kind === 'favorites' ? favorites : recent).value = items
      storageError.value = ''
    } catch { storageError.value = '保存失败，请检查浏览器存储权限或可用空间后重试。' }
  }
  function isFavorite(slug: string) { return favorites.value.some(item => item.slug === slug) }
  function removeFavorite(slug: string) { save('favorites', favorites.value.filter(item => item.slug !== slug)) }
  function toggleFavorite(item: LocalNavigationItem) {
    if (!ready.value) return
    if (isFavorite(item.slug)) removeFavorite(item.slug)
    else save('favorites', prependNavigation(favorites.value, item, 'favorites'))
  }
  function addRecent(item: LocalNavigationItem) { if (ready.value && !storageError.value) save('recent', prependNavigation(recent.value, { ...item, visitedAt: new Date().toISOString() }, 'recent')) }
  function clearRecent() { save('recent', []) }
  function clearFavorites() { save('favorites', []) }
  onMounted(init)
  return { favorites, recent, ready, storageError, init, isFavorite, toggleFavorite, addRecent, removeFavorite, clearRecent, clearFavorites }
}
