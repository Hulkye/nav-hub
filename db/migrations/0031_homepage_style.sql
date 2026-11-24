ALTER TABLE homepage_modules ADD COLUMN IF NOT EXISTS background text NOT NULL DEFAULT 'default' CHECK (background IN ('default', 'surface', 'accent'));
ALTER TABLE homepage_modules ADD COLUMN IF NOT EXISTS density text NOT NULL DEFAULT 'comfortable' CHECK (density IN ('compact', 'comfortable', 'relaxed'));
