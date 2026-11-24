export const taxonomyIcons = {
  CategoryManagement: '分类', Tag: '标签', Comment: '对话', Search: '搜索', Workbench: '办公',
  Book: '书籍', Translate: '翻译', Browser: '浏览器', Edit: '写作', Picture: '图像',
  Video: '视频', Music: '音乐', ColorCard: '设计', Cube: '立体模型', User: '用户',
  ScanCode: '检测', Code: '代码', Robot: '机器人', Connection: '工作流', Api: '接口',
  Github: '开源', ChartLine: '数据图表', ShoppingCart: '购物', School: '教育', Briefcase: '专业服务',
  Terminal: '终端', FolderOpen: '文件夹', People: '社区', ReadBook: '阅读',
  Calendar: '日历', NewspaperFolding: '资讯'
} as const

export type TaxonomyIconName = keyof typeof taxonomyIcons

export function isTaxonomyIcon(name: string): name is TaxonomyIconName {
  return Object.hasOwn(taxonomyIcons, name)
}

export const categoryDefaultIcons: Readonly<Partial<Record<string, TaxonomyIconName>>> = {
  'ai-chat': 'Comment', 'ai-search': 'Search', 'ai-office': 'Workbench', 'ai-knowledge': 'Book',
  'ai-translation': 'Translate', 'ai-desktop': 'Browser', 'ai-writing': 'Edit', 'ai-image': 'Picture',
  'ai-video': 'Video', 'ai-audio': 'Music', 'ai-design': 'ColorCard', 'ai-3d': 'Cube',
  'ai-avatar': 'User', 'ai-detection': 'ScanCode', 'ai-coding': 'Code', 'ai-agents': 'Robot',
  'ai-workflows': 'Connection', 'ai-models': 'Cube', 'ai-platforms': 'Api', 'ai-open-source': 'Github',
  'ai-data-evaluation': 'ChartLine', 'ai-marketing': 'ShoppingCart', 'ai-education-research': 'School',
  'ai-professional': 'Briefcase', 'ai-prompts': 'Terminal', 'ai-assets': 'FolderOpen',
  'ai-community': 'People', 'ai-learning': 'ReadBook', 'ai-news': 'NewspaperFolding', 'ai-events': 'Calendar'
}
