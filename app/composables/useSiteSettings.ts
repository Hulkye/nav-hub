import { defaultSiteSettings, siteSettingsSchema, type SiteSettings } from '#shared/schemas/settings'

export async function useSiteSettings() {
  const { data } = await useFetch<{ settings: SiteSettings }>('/api/public/settings', { key: 'site-settings' })
  return computed(() => siteSettingsSchema.parse(data.value?.settings ?? defaultSiteSettings))
}
