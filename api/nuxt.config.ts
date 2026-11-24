import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  devServer: { host: '127.0.0.1', port: 3002 },
  alias: { '#shared': fileURLToPath(new URL('../shared', import.meta.url)) },
  modules: [],
  pages: false,
  ssr: false,
  hooks: { 'nitro:config'(config) { config.noPublicDir = true } },
  compatibilityDate: '2025-07-15',
  typescript: { strict: true, typeCheck: true },
  runtimeConfig: {
    storage: {
      endpoint: process.env.S3_ENDPOINT || '',
      region: process.env.S3_REGION || 'us-east-1',
      bucket: process.env.S3_BUCKET || '',
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true'
    },
    databaseUrl: process.env.DATABASE_URL || '',
    trustedProxyIps: process.env.NUXT_TRUSTED_PROXY_IPS || '',
    public: { siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000' }
  }
})
