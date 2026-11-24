CREATE VIEW image_asset_references AS
SELECT a.id AS asset_id, 'site' AS content_type, s.id::text AS content_id, s.title, 'icon_url' AS field
FROM image_assets a JOIN sites s ON strpos(lower(s.icon_url), '/api/assets/' || a.id::text) > 0
UNION ALL
SELECT a.id, 'resource', r.id::text, r.title, 'cover_url'
FROM image_assets a JOIN resources r ON strpos(lower(r.cover_url), '/api/assets/' || a.id::text) > 0
UNION ALL
SELECT a.id, 'media', m.id::text, m.title, 'cover_url'
FROM image_assets a JOIN media_items m ON strpos(lower(m.cover_url), '/api/assets/' || a.id::text) > 0
UNION ALL
SELECT a.id, 'article', ar.id::text, ar.title, 'cover_url'
FROM image_assets a JOIN articles ar ON strpos(lower(ar.cover_url), '/api/assets/' || a.id::text) > 0
UNION ALL
SELECT a.id, 'article', ar.id::text, ar.title, 'body'
FROM image_assets a JOIN articles ar ON strpos(lower(ar.body), '/api/assets/' || a.id::text) > 0
UNION ALL
SELECT a.id, 'submission', s.id::text, COALESCE(s.payload->>'title', '待审核投稿'), 'payload'
FROM image_assets a JOIN guest_submissions s ON s.status = 'pending' AND strpos(lower(s.payload::text), '/api/assets/' || a.id::text) > 0;
