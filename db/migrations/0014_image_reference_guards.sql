CREATE FUNCTION check_image_asset_references() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  document text;
  asset_match text[];
BEGIN
  IF TG_TABLE_NAME = 'sites' THEN
    document := COALESCE(NEW.icon_url, '');
  ELSIF TG_TABLE_NAME = 'articles' THEN
    document := COALESCE(NEW.cover_url, '') || ' ' || COALESCE(NEW.body, '');
  ELSE
    document := COALESCE(NEW.cover_url, '');
  END IF;
  FOR asset_match IN SELECT regexp_matches(document, '/api/assets/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})', 'g') LOOP
    PERFORM id FROM image_assets WHERE id = asset_match[1]::uuid FOR KEY SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Referenced image does not exist' USING ERRCODE = '23503', CONSTRAINT = 'image_asset_reference_exists';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sites_image_reference_guard BEFORE INSERT OR UPDATE OF icon_url ON sites
FOR EACH ROW EXECUTE FUNCTION check_image_asset_references();
CREATE TRIGGER resources_image_reference_guard BEFORE INSERT OR UPDATE OF cover_url ON resources
FOR EACH ROW EXECUTE FUNCTION check_image_asset_references();
CREATE TRIGGER media_image_reference_guard BEFORE INSERT OR UPDATE OF cover_url ON media_items
FOR EACH ROW EXECUTE FUNCTION check_image_asset_references();
CREATE TRIGGER articles_image_reference_guard BEFORE INSERT OR UPDATE OF cover_url, body ON articles
FOR EACH ROW EXECUTE FUNCTION check_image_asset_references();
