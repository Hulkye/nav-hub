ALTER TABLE homepage_modules DROP CONSTRAINT homepage_modules_module_type_check;
ALTER TABLE homepage_modules ADD CONSTRAINT homepage_modules_module_type_check
  CHECK (module_type IN ('featured', 'latest', 'updated', 'popular', 'popular_categories', 'category', 'announcement', 'banner'));
ALTER TABLE homepage_modules ADD COLUMN banner_text text NOT NULL DEFAULT '' CHECK (length(banner_text) <= 500);
ALTER TABLE homepage_modules ADD COLUMN banner_url text NOT NULL DEFAULT '' CHECK (length(banner_url) <= 2048);
