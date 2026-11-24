ALTER TABLE homepage_modules ADD COLUMN content_type text NOT NULL DEFAULT 'site'
  CHECK (content_type IN ('site', 'resource', 'media', 'article', 'announcement'));
UPDATE homepage_modules SET content_type = 'announcement' WHERE module_type = 'announcement';

CREATE TABLE site_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  settings jsonb NOT NULL CHECK (jsonb_typeof(settings) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
