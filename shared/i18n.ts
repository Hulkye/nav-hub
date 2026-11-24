export type Locale = 'zh-CN' | 'en-US'

export const localeLabels: Record<Locale, string> = {
  'zh-CN': '简体中文',
  'en-US': 'English'
}

export const messages = {
  'zh-CN': {
    nav: { home: '首页', resources: '资源', articles: '文章', media: '书影音', search: '搜索', submit: '投稿', admin: '管理台', rankings: '排行榜', myNavigation: '我的导航', tags: '标签', announcements: '公告' },
    home: {
      eyebrow: 'NAVHUB DIRECTORY',
      title: '好网站，慢慢发现。',
      description: '收集好用的工具、值得读的内容，留给每一次需要。',
      searchPlaceholder: '搜索网站、资源或文章',
      search: '搜索',
      categories: '目录分类',
      all: '全部网站',
      curated: '精选网站',
      viewAll: '查看全部',
      empty: '暂无精选网站',
      submit: '提交一个好网站'
    },
    common: { language: '语言', theme: '主题', light: '浅色', dark: '深色', system: '跟随系统', switchTheme: '切换主题', toggleMenu: '切换菜单', mainNavigation: '主导航', footerNavigation: '页脚导航', quickNavigation: '移动端快捷导航', unavailable: '内容暂时无法加载，请稍后重试。', empty: '暂无已发布内容。', submitting: '提交中…', failed: '提交失败，请稍后重试', name: '称呼', optionalName: '称呼（可选）', optionalEmail: '联系邮箱（可选）', description: '简介', previous: '上一页', next: '下一页', all: '全部', type: '内容类型' }
  },
  'en-US': {
    nav: { home: 'Home', resources: 'Resources', articles: 'Articles', media: 'Media', search: 'Search', submit: 'Submit', admin: 'Admin', rankings: 'Rankings', myNavigation: 'My navigation', tags: 'Tags', announcements: 'Announcements' },
    home: {
      eyebrow: 'NAVHUB DIRECTORY',
      title: 'Find useful websites, start here.',
      description: 'Curated internet resources to help you discover tools worth keeping.',
      searchPlaceholder: 'Search websites, resources or articles',
      search: 'Search',
      categories: 'Categories',
      all: 'All websites',
      curated: 'Featured websites',
      viewAll: 'View all',
      empty: 'No featured websites yet',
      submit: 'Submit a website'
    },
    common: { language: 'Language', theme: 'Theme', light: 'Light', dark: 'Dark', system: 'System', switchTheme: 'Switch theme', toggleMenu: 'Toggle menu', mainNavigation: 'Main navigation', footerNavigation: 'Footer navigation', quickNavigation: 'Mobile shortcuts', unavailable: 'Content is temporarily unavailable. Please try again later.', empty: 'No published content yet.', submitting: 'Submitting…', failed: 'Submission failed. Please try again later.', name: 'Name', optionalName: 'Name (optional)', optionalEmail: 'Email (optional)', description: 'Description', previous: 'Previous', next: 'Next', all: 'All', type: 'Content type' }
  }
} as const

export type MessageKey = keyof (typeof messages)['zh-CN']

export const translationKeys = Object.entries(messages['zh-CN']).flatMap(([group, entries]) =>
  Object.keys(entries).map(key => `${group}.${key}`)
)

export interface TranslationOverride {
  key: string
  zhCN: string
  enUS: string
}

export function translate(locale: Locale, path: string, overrides: readonly TranslationOverride[] = []): string {
  const override = overrides.find(item => item.key === path)
  if (override) return locale === 'zh-CN' ? override.zhCN : override.enUS
  let value: unknown = messages[locale]
  for (const part of path.split('.')) {
    value = value && typeof value === 'object' && Object.hasOwn(value, part)
      ? (value as Record<string, unknown>)[part] : undefined
  }
  return typeof value === 'string' ? value : path
}
