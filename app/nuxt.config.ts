import { fileURLToPath } from 'node:url'

const apiOrigin = process.env.API_ORIGIN || 'http://127.0.0.1:3002'

export default defineNuxtConfig({
  srcDir: '.',
  serverDir: './server',
  alias: { '#shared': fileURLToPath(new URL('../shared', import.meta.url)) },
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  typescript: { strict: true, typeCheck: true },
  css: ['@icon-park/vue-next/styles/index.css', '~/assets/css/main.css'],
  routeRules: {
    '/api/**': { proxy: `${apiOrigin}/api/**` },
    '/out/**': { proxy: `${apiOrigin}/api/out/**` },
    '/robots.txt': { proxy: `${apiOrigin}/robots.txt` },
    '/sitemap.xml': { proxy: `${apiOrigin}/sitemap.xml` },
    '/rss.xml': { proxy: `${apiOrigin}/rss.xml` },
    '/admin': { proxy: `${process.env.ADMIN_ORIGIN || 'http://127.0.0.1:3001'}/admin/` },
    '/admin/**': { proxy: `${process.env.ADMIN_ORIGIN || 'http://127.0.0.1:3001'}/admin/**` }
  },
  nitro: {
    devProxy: {
      '/admin/_nuxt/': { target: `${process.env.ADMIN_ORIGIN || 'http://127.0.0.1:3001'}/admin/_nuxt/`, ws: true }
    }
  },
  app: { head: { title: 'NavHub', meta: [{ name: 'description', content: '发现值得收藏的网站、应用与内容。' }], link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }, { rel: 'preconnect', href: 'https://fonts.googleapis.com' }, { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }, { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Noto+Sans+SC:wght@400;500;600;700;800&family=Noto+Serif+SC:wght@600;700&display=swap' }] } },
  runtimeConfig: { public: { siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000' } }
})
