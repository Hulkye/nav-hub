import { effectiveTheme, validTheme, type ThemePreference } from '#shared/theme'
import type { SiteSettings } from '#shared/schemas/settings'
export type { ThemePreference } from '#shared/theme'

const themePreferences: ThemePreference[] = ['light', 'dark', 'system']

export function useTheme(settings?: Readonly<Ref<SiteSettings>>) {
  const override = useCookie<ThemePreference | null>('theme', {
    sameSite: 'lax', maxAge: 60 * 60 * 24 * 365,
  })
  const preference = computed(() => effectiveTheme(override.value, settings?.value.theme.defaultMode ?? 'system'))
  const systemDark = useState('system-dark', () => false)
  const resolvedTheme = computed(() => preference.value === 'system' ? (systemDark.value ? 'dark' : 'light') : preference.value)
  useHead(() => ({ htmlAttrs: { 'data-theme': preference.value, 'data-accent': settings?.value.theme.accent ?? 'blue' } }))

  const setTheme = (value: ThemePreference) => {
    override.value = value
    if (import.meta.client) {
      try { window.localStorage.setItem('theme', value) } catch { /* Cookies still persist preferences when storage is unavailable. */ }
    }
  }
  const cycleTheme = () => setTheme(themePreferences[(themePreferences.indexOf(preference.value) + 1) % themePreferences.length]!)

  if (import.meta.client) {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const updateSystemTheme = () => { systemDark.value = media.matches }
    onMounted(() => {
      if (!validTheme(override.value)) {
        try {
          const stored = validTheme(window.localStorage.getItem('theme'))
          if (stored) override.value = stored
        } catch { /* The site default remains available without local storage. */ }
      }
      updateSystemTheme()
      media.addEventListener('change', updateSystemTheme)
    })
    onBeforeUnmount(() => media.removeEventListener('change', updateSystemTheme))
  }
  return { preference, resolvedTheme, setTheme, cycleTheme }
}
