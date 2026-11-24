export type ContentType = 'site' | 'resource' | 'media' | 'article'

export interface NavigationItem {
  title: string
  description: string
  slug: string
  type: ContentType
  category: string
  href: string
  featured?: boolean
}

export interface AdminSession {
  id: string
  username: string
  expiresAt: number
}
