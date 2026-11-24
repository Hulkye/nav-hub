import type { ContentDatabase } from './content'

export type StoredAsset = {
  id: string; object_key: string; filename: string; content_type: string
  byte_size: number; width: number; height: number; created_at: string
}

export type AssetReference = { content_type: string; content_id: string; title: string; field: string }

export function createAssetRepository(db: ContentDatabase) {
  return {
    async list(page: number, search = '') {
      const parameters: unknown[] = []
      const where = search ? `WHERE filename ILIKE $1` : ''
      if (search) parameters.push(`%${search}%`)
      parameters.push((page - 1) * 24)
      const [items, count] = await Promise.all([
        db.query<StoredAsset & { reference_count: number }>(`SELECT a.*, (SELECT count(*)::int FROM image_asset_references r WHERE r.asset_id = a.id) AS reference_count FROM image_assets a ${where} ORDER BY a.created_at DESC, a.id LIMIT 24 OFFSET $${parameters.length}`, parameters),
        db.query<{ total: number }>(`SELECT count(*)::int AS total FROM image_assets ${where}`, search ? [parameters[0]] : [])
      ])
      return { items: items.rows, total: count.rows[0]!.total, page, pageSize: 24 }
    },
    async get(id: string) {
      return (await db.query<StoredAsset>('SELECT * FROM image_assets WHERE id = $1', [id])).rows[0]
    },
    async create(asset: Omit<StoredAsset, 'created_at'>, adminId: string) {
      return db.transaction(async tx => {
        const result = await tx.query<StoredAsset>(`INSERT INTO image_assets (id, object_key, filename, content_type, byte_size, width, height, uploaded_by)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [asset.id, asset.object_key, asset.filename, asset.content_type, asset.byte_size, asset.width, asset.height, adminId])
        await tx.query('INSERT INTO admin_audit_logs (admin_id, action, resource, resource_id) VALUES ($1,$2,$3,$4)', [adminId, 'upload', 'image_assets', asset.id])
        return result.rows[0]!
      })
    },
    async references(id: string) {
      return (await db.query<AssetReference>('SELECT content_type, content_id, title, field FROM image_asset_references WHERE asset_id = $1 ORDER BY content_type, title', [id])).rows
    },
    async remove(id: string, adminId: string, deleteObject: (key: string) => Promise<void>) {
      return db.transaction(async tx => {
        await tx.query("SET LOCAL lock_timeout = '5s'")
        await tx.query('LOCK TABLE sites, resources, media_items, articles, guest_submissions IN SHARE ROW EXCLUSIVE MODE')
        const settingsTable = await tx.query<{ exists: boolean }>("SELECT to_regclass('site_settings') IS NOT NULL AS exists")
        if (settingsTable.rows[0]?.exists) await tx.query('LOCK TABLE site_settings IN SHARE ROW EXCLUSIVE MODE')
        const asset = (await tx.query<StoredAsset>('SELECT * FROM image_assets WHERE id = $1 FOR UPDATE', [id])).rows[0]
        if (!asset) return undefined
        const references = await tx.query<AssetReference>('SELECT content_type, content_id, title, field FROM image_asset_references WHERE asset_id = $1', [id])
        if (references.rows.length) return { deleted: false, references: references.rows }
        await tx.query('INSERT INTO admin_audit_logs (admin_id, action, resource, resource_id) VALUES ($1,$2,$3,$4)', [adminId, 'delete', 'image_assets', id])
        await deleteObject(asset.object_key)
        await tx.query('DELETE FROM image_assets WHERE id = $1', [id])
        return { deleted: true }
      })
    }
  }
}
