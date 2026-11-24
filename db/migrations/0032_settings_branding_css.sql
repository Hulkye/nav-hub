DROP VIEW image_asset_references;
CREATE VIEW image_asset_references AS
SELECT * FROM image_asset_content_references
UNION ALL SELECT a.id, 'site_settings', s.id::text, s.settings->>'name', 'logoUrl' FROM image_assets a JOIN site_settings s ON strpos(lower(s.settings->>'logoUrl'), '/api/assets/' || a.id::text) > 0
UNION ALL SELECT a.id, 'site_settings', s.id::text, s.settings->>'name', 'faviconUrl' FROM image_assets a JOIN site_settings s ON strpos(lower(s.settings->>'faviconUrl'), '/api/assets/' || a.id::text) > 0
UNION ALL SELECT a.id, 'site_settings', s.id::text, s.settings->>'name', 'seo.imageUrl' FROM image_assets a JOIN site_settings s ON strpos(lower(s.settings->'seo'->>'imageUrl'), '/api/assets/' || a.id::text) > 0;
CREATE OR REPLACE FUNCTION check_settings_image_references() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE document text; asset_match text[];
BEGIN
  document := COALESCE(NEW.settings->>'logoUrl', '') || ' ' || COALESCE(NEW.settings->>'faviconUrl', '') || ' ' || COALESCE(NEW.settings->'seo'->>'imageUrl', '');
  FOR asset_match IN SELECT regexp_matches(document, '/api/assets/([0-9a-fA-F-]{36})', 'g') LOOP
    PERFORM id FROM image_assets WHERE id = asset_match[1]::uuid FOR KEY SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Referenced image does not exist' USING ERRCODE = '23503', CONSTRAINT = 'image_asset_reference_exists'; END IF;
  END LOOP;
  RETURN NEW;
END; $$;
