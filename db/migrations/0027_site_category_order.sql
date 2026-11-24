CREATE TABLE site_category_settings (
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  pinned boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (site_id, category_id)
);
CREATE INDEX site_category_settings_order_idx ON site_category_settings(category_id, pinned DESC, sort_order, site_id);

CREATE TABLE resource_categories (
  resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (resource_id, category_id)
);
CREATE TABLE media_categories (
  media_id uuid NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (media_id, category_id)
);
CREATE TABLE article_categories (
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, category_id)
);
CREATE INDEX resource_categories_category_idx ON resource_categories(category_id, resource_id);
CREATE INDEX media_categories_category_idx ON media_categories(category_id, media_id);
CREATE INDEX article_categories_category_idx ON article_categories(category_id, article_id);

