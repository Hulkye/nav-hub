import { translate, type Locale } from '#shared/i18n'
import type { SiteSettings } from '#shared/schemas/settings'

export function useI18n(settings?: Readonly<Ref<SiteSettings>>) {
  const { data: publicSettings } = useNuxtData<{ settings: SiteSettings }>('site-settings')
  const storedLocale = useCookie<string>('navhub_locale', { default: () => 'zh-CN', sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 })
  const locale = computed<Locale>(() => storedLocale.value === 'en-US' ? 'en-US' : 'zh-CN')
  const setLocale = (value: Locale) => { storedLocale.value = value }
  useHead(() => ({ htmlAttrs: { lang: locale.value } }))
  const t = (path: string): string => {
    return translate(locale.value, path, settings?.value.translations ?? publicSettings.value?.settings.translations ?? [])
  }
  const text = (zh: string, en: string) => locale.value === 'zh-CN' ? zh : en
  return { locale, setLocale, t, text }
}
