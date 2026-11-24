import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  modules: ['@nuxt/ui'],
  alias: { '#shared': fileURLToPath(new URL('../shared', import.meta.url)) },
  devtools: { enabled: true },
  devServer: { host: '127.0.0.1', port: 3001 },
  vite: {
    server: {
      hmr: {
        protocol: 'ws',
        host: 'localhost',
        clientPort: 3000,
        path: '/'
      }
    }
  },
  app: {
    baseURL: '/admin/',
    head: {
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/admin/favicon.ico' },
        ...(process.env.NODE_ENV === 'development'
          ? [{ rel: 'stylesheet' as const, href: '/admin/_nuxt/assets/css/main.css?direct' }]
          : [])
      ]
    }
  },
  css: ['~/assets/css/main.css'],
  ui: { fonts: false },
  routeRules: {
    '/**': { headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    '/api/**': { proxy: `${process.env.API_ORIGIN || 'http://127.0.0.1:3002'}/api/**` },
    '/admin/api/**': { proxy: `${process.env.API_ORIGIN || 'http://127.0.0.1:3002'}/api/**` }
  },
  typescript: { strict: true, typeCheck: true },
  compatibilityDate: '2026-06-30'
})
