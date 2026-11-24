CREATE TABLE homepage_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_type text NOT NULL CHECK (module_type IN ('featured', 'latest', 'category', 'announcement')),
  title text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  item_limit integer NOT NULL DEFAULT 12 CHECK (item_limit BETWEEN 1 AND 48),
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  content_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX homepage_modules_sort_idx ON homepage_modules(sort_order);
CREATE INDEX homepage_modules_enabled_idx ON homepage_modules(enabled, sort_order);
