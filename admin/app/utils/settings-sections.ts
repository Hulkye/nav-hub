import type { SiteSettings } from '#shared/schemas/settings'

export const settingsSections = [
  { id: 'brand', title: '品牌与页脚', description: '设置网站名称、Logo、favicon、介绍与页脚文字。', icon: 'i-lucide-fingerprint', keys: ['name', 'logoUrl', 'faviconUrl', 'description', 'footer'] },
  { id: 'navigation', title: '主导航', description: '管理顶部导航的链接名称与目标地址。', icon: 'i-lucide-navigation', keys: ['navigation'] },
  { id: 'theme', title: '主题', description: '设置访客默认主题、强调色和安全外观变量。', icon: 'i-lucide-palette', keys: ['theme', 'customCss'] },
  { id: 'site-cards', title: '网站卡片', description: '分别配置卡片主体和右上角箭头的点击行为。', icon: 'i-lucide-panels-top-left', keys: ['siteCardBehavior', 'siteCardArrowBehavior'] },
  { id: 'search', title: '搜索源', description: '管理外部搜索源、展示顺序与默认选项。', icon: 'i-lucide-search', keys: ['searchSources', 'defaultSearchSource'] },
  { id: 'translations', title: '内置文案覆盖', description: '自定义界面控件的中英文文案。', icon: 'i-lucide-languages', keys: ['translations'] },
  { id: 'mobile-navigation', title: '移动端底部导航', description: '配置移动端导航标签、链接与排列顺序。', icon: 'i-lucide-smartphone', keys: ['mobileTabs'] },
  { id: 'seo', title: '默认 SEO', description: '设置搜索标题、关键词与社交分享信息。', icon: 'i-lucide-globe', keys: ['seo'] }
] as const satisfies readonly { id: string; title: string; description: string; icon: string; keys: readonly (keyof SiteSettings)[] }[]
