import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from '../../../db/schema/index'
import { createAuthRepository } from '../repositories/auth'
import { createContentRepository } from '../repositories/content'
import { createAssetRepository } from '../repositories/assets'
import { createHomepageRepository } from '../repositories/homepage'
import { createSiteDetailsRepository } from '../repositories/site-details'
import { createRankingsRepository } from '../repositories/rankings'
import { createDiscoveryRepository } from '../repositories/discovery'
import { createSubmissionReceiptsRepository } from '../repositories/submission-receipts'
import { createSearchDiscoveryRepository } from '../repositories/search-discovery'
import { createPublicDirectoryRepository } from '../repositories/public-directory'

export function getPublicDirectoryRepository() {
  return createPublicDirectoryRepository(getContentDatabase())
}

export function getSearchDiscoveryRepository() {
  return createSearchDiscoveryRepository(getContentDatabase())
}
import { createSubmissionNotificationsRepository } from '../repositories/submission-notifications'

let pool: pg.Pool | undefined

export function getSubmissionNotificationsRepository() {
  return createSubmissionNotificationsRepository(getContentDatabase())
}

export function getDiscoveryRepository() {
  return createDiscoveryRepository(getContentDatabase())
}

export function getSubmissionReceiptsRepository() {
  return createSubmissionReceiptsRepository(getContentDatabase())
}

export function getRankingsRepository() {
  return createRankingsRepository(getContentDatabase())
}

export function getDatabase() {
  if (!pool) {
    const { databaseUrl } = useRuntimeConfig()
    if (!databaseUrl) throw createError({ statusCode: 503, message: '数据库尚未配置', data: { code: 'DATABASE_NOT_CONFIGURED' } })
    pool = new pg.Pool({ connectionString: databaseUrl, max: 10, connectionTimeoutMillis: 5000 })
    pool.on('error', () => console.error('[database] Idle connection failed'))
  }
  return drizzle(pool, { schema })
}

export function getAuthRepository() {
  getDatabase()
  return createAuthRepository(pool!)
}

export function getContentRepository() {
  return createContentRepository(getContentDatabase())
}

export function getAssetRepository() {
  return createAssetRepository(getContentDatabase())
}

export function getHomepageRepository() {
  return createHomepageRepository(getContentDatabase())
}

export function getSiteDetailsRepository() {
  return createSiteDetailsRepository(getContentDatabase())
}

function getContentDatabase(): import('../repositories/content').ContentDatabase {
  getDatabase()
  return {
    query: (sql, parameters) => pool!.query(sql, parameters),
    async transaction(callback) {
      const client = await pool!.connect()
      const tx = {
        query: async <T extends Record<string, unknown>>(sql: string, parameters?: unknown[]) => ({ rows: (await client.query<T>(sql, parameters)).rows }),
        transaction: async <R>(nestedCallback: (database: import('../repositories/content').ContentDatabase) => Promise<R>): Promise<R> => nestedCallback(tx)
      }
      try {
        await client.query('BEGIN')
        const result = await callback(tx)
        await client.query('COMMIT')
        return result
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    }
  }
}
