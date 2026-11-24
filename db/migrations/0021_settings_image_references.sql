ALTER VIEW image_asset_references RENAME TO image_asset_content_references;

CREATE VIEW image_asset_references AS
SELECT * FROM image_asset_content_references
UNION ALL
SELECT a.id, 'site_settings', s.id::text, s.settings->>'name', 'logoUrl'
FROM image_assets a JOIN site_settings s ON strpos(lower(s.settings->>'logoUrl'), '/api/assets/' || a.id::text) > 0
UNION ALL
SELECT a.id, 'site_settings', s.id::text, s.settings->>'name', 'seo.imageUrl'
FROM image_assets a JOIN site_settings s ON strpos(lower(s.settings->'seo'->>'imageUrl'), '/api/assets/' || a.id::text) > 0;

CREATE FUNCTION check_settings_image_references() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  document text;
  asset_match text[];
BEGIN
  document := COALESCE(NEW.settings->>'logoUrl', '') || ' ' || COALESCE(NEW.settings->'seo'->>'imageUrl', '');
  FOR asset_match IN SELECT regexp_matches(document, '/api/assets/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})', 'g') LOOP
    PERFORM id FROM image_assets WHERE id = asset_match[1]::uuid FOR KEY SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Referenced image does not exist' USING ERRCODE = '23503', CONSTRAINT = 'image_asset_reference_exists';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER settings_image_reference_guard BEFORE INSERT OR UPDATE OF settings ON site_settings
FOR EACH ROW EXECUTE FUNCTION check_settings_image_references();
