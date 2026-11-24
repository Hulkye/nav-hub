import { z } from 'zod'
import { translationKeys } from '../i18n'
import { searchSourceSchema, defaultSearchSources } from './search-sources'

const safeUrl = z.string().trim().max(2048).refine(value => {
  if (/[\\\s\u0000-\u001f]/.test(value)) return false
  if (/^\/(?!\/)/.test(value)) return true
  try { return ['http:', 'https:'].includes(new URL(value).protocol) } catch { return false }
}, '请输入站内路径或 HTTP(S) 地址')

export const siteNavigationSchema = z.object({
  label: z.string().trim().min(1).max(80),
  to: safeUrl
}).strict()

export const themePreferenceSchema = z.enum(['light', 'dark', 'system'])
export const accentPaletteSchema = z.enum(['blue', 'violet', 'emerald', 'rose'])
export const translationKeySchema = z.enum(translationKeys as [string, ...string[]])
export const translationOverrideSchema = z.object({
  key: translationKeySchema,
  zhCN: z.string().trim().min(1).max(240),
  enUS: z.string().trim().min(1).max(240)
}).strict()
export const customCssVariablesSchema = z.object({
  cardRadius: z.enum(['default', '8px', '12px', '16px']).default('default'),
  cardShadow: z.enum(['default', 'none', 'soft']).default('default')
}).strict()
export const defaultMobileTabs = [
  { label: '首页', to: '/' }, { label: '搜索', to: '/search' }, { label: '投稿', to: '/submit' }
]

export const siteSettingsSchema = z.object({
  name: z.string().trim().min(1).max(100),
  logoUrl: z.union([z.literal(''), safeUrl]).default(''),
  faviconUrl: z.union([z.literal(''), safeUrl]).default(''),
  description: z.string().trim().max(500).default(''),
  footer: z.string().trim().max(1000).default(''),
  navigation: z.array(siteNavigationSchema).max(12),
  mobileTabs: z.array(siteNavigationSchema).max(5).default(defaultMobileTabs),
  searchSources: z.array(searchSourceSchema).max(12).refine(items => new Set(items.map(item => item.id)).size === items.length && items.every(item => item.id !== 'internal'), '搜索源 ID 不能重复或使用 internal').default(defaultSearchSources),
  defaultSearchSource: z.string().max(40).default('internal'),
  siteCardBehavior: z.enum(['detail', 'direct']).default('detail'),
  siteCardArrowBehavior: z.enum(['detail', 'direct']).default('direct'),
  theme: z.object({
    defaultMode: themePreferenceSchema.default('system'),
    accent: accentPaletteSchema.default('blue')
  }).strict().default({ defaultMode: 'system', accent: 'blue' }),
  customCss: customCssVariablesSchema.default({ cardRadius: 'default', cardShadow: 'default' }),
  translations: z.array(translationOverrideSchema).max(80).refine(items => new Set(items.map(item => item.key)).size === items.length, '文案键不能重复').default([]),
  seo: z.object({
    title: z.string().trim().max(160).default(''),
    description: z.string().trim().max(500).default(''),
    keywords: z.string().trim().max(500).default(''),
    imageUrl: z.union([z.literal(''), safeUrl]).default('')
  }).strict()
}).strict().refine(settings => settings.defaultSearchSource === 'internal' || settings.searchSources.some(source => source.enabled && source.id === settings.defaultSearchSource), '默认搜索源必须启用')

export type SiteSettings = z.infer<typeof siteSettingsSchema>

export const defaultSiteSettings: SiteSettings = {
  name: 'NavHub', logoUrl: '', faviconUrl: '', description: '发现值得收藏的网站、应用与内容。',
  footer: 'NavHub · 发现值得收藏的网站、应用与内容。',
  mobileTabs: defaultMobileTabs,
  searchSources: defaultSearchSources,
  defaultSearchSource: 'internal',
  siteCardBehavior: 'detail',
  siteCardArrowBehavior: 'direct',
  theme: { defaultMode: 'system', accent: 'blue' },
  customCss: { cardRadius: 'default', cardShadow: 'default' },
  translations: [],
  navigation: [{ label: '首页', to: '/' }, { label: '资源', to: '/resources' }, { label: '文章', to: '/articles' }, { label: '书影音', to: '/media' }, { label: '排行榜', to: '/rankings' }, { label: '我的导航', to: '/my-navigation' }, { label: '搜索', to: '/search' }],
  seo: { title: 'NavHub', description: '发现值得收藏的网站、应用与内容。', keywords: '', imageUrl: '' }
}
