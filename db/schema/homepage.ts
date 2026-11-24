import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import type { SiteSettings } from '../../shared/schemas/settings'

export const homepageModules = pgTable('homepage_modules', {
  id: uuid('id').primaryKey().defaultRandom(),
  moduleType: text('module_type').notNull(),
  placement: text('placement').notNull().default('top'),
  contentType: text('content_type').notNull().default('site'),
  title: text('title').notNull().default(''),
  enabled: boolean('enabled').notNull().default(true),
  sortOrder: integer('sort_order').notNull().unique().default(0),
  itemLimit: integer('item_limit').notNull().default(12),
  categoryId: uuid('category_id'),
  contentIds: uuid('content_ids').array().notNull().default([]),
  background: text('background').notNull().default('default'),
  density: text('density').notNull().default('comfortable'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})

export const siteSettings = pgTable('site_settings', {
  id: integer('id').primaryKey().default(1),
  settings: jsonb('settings').$type<SiteSettings>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})

export const siteCategorySettings = pgTable('site_category_settings', {
  siteId: uuid('site_id').notNull(),
  categoryId: uuid('category_id').notNull(),
  pinned: boolean('pinned').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, table => [index('site_category_settings_order_idx').on(table.categoryId, table.pinned, table.sortOrder, table.siteId)])
