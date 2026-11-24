ALTER TABLE resources
  ADD COLUMN platforms jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(platforms) = 'array' AND jsonb_array_length(platforms) <= 12),
  ADD COLUMN version text NOT NULL DEFAULT '' CHECK (length(version) <= 80),
  ADD COLUMN screenshots jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(screenshots) = 'array' AND jsonb_array_length(screenshots) <= 12),
  ADD COLUMN download_sources jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(download_sources) = 'array' AND jsonb_array_length(download_sources) <= 12),
  ADD COLUMN version_history jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(version_history) = 'array' AND jsonb_array_length(version_history) <= 30);

ALTER TABLE media_items
  ADD COLUMN author text NOT NULL DEFAULT '' CHECK (length(author) <= 160),
  ADD COLUMN director text NOT NULL DEFAULT '' CHECK (length(director) <= 160),
  ADD COLUMN publisher text NOT NULL DEFAULT '' CHECK (length(publisher) <= 160),
  ADD COLUMN release_date date,
  ADD COLUMN channels jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(channels) = 'array' AND jsonb_array_length(channels) <= 12);

CREATE OR REPLACE VIEW image_asset_references AS
SELECT a.id AS asset_id, 'site' AS content_type, s.id::text AS content_id, s.title, 'icon_url' AS field
FROM image_assets a JOIN sites s ON strpos(lower(s.icon_url), '/api/assets/' || a.id::text) > 0
UNION ALL
SELECT a.id, 'resource', r.id::text, r.title, 'cover_url'
FROM image_assets a JOIN resources r ON strpos(lower(r.cover_url), '/api/assets/' || a.id::text) > 0
UNION ALL
SELECT a.id, 'resource', r.id::text, r.title, 'screenshots'
FROM image_assets a JOIN resources r ON strpos(lower(r.screenshots::text), '/api/assets/' || a.id::text) > 0
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

CREATE FUNCTION check_resource_screenshot_references() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE asset_match text[];
BEGIN
  FOR asset_match IN SELECT regexp_matches(NEW.screenshots::text, '/api/assets/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})', 'g') LOOP
    PERFORM id FROM image_assets WHERE id = asset_match[1]::uuid FOR KEY SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Referenced image does not exist' USING ERRCODE = '23503', CONSTRAINT = 'image_asset_reference_exists';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER resources_screenshot_reference_guard BEFORE INSERT OR UPDATE OF screenshots ON resources
FOR EACH ROW EXECUTE FUNCTION check_resource_screenshot_references();
