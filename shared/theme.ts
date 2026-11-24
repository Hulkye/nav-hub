import { themePreferenceSchema } from './schemas/settings'

export type ThemePreference = 'light' | 'dark' | 'system'

export function validTheme(value: unknown): ThemePreference | undefined {
  const result = themePreferenceSchema.safeParse(value)
  return result.success ? result.data : undefined
}

export function effectiveTheme(override: unknown, siteDefault: ThemePreference): ThemePreference {
  return validTheme(override) ?? siteDefault
}
