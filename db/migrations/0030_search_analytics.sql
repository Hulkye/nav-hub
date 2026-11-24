CREATE TABLE search_analytics (
  slot integer PRIMARY KEY CHECK (slot >= 0 AND slot < 4096),
  term varchar(120) NOT NULL CHECK (length(term) >= 2),
  content_type text NOT NULL CHECK (content_type IN ('all', 'site', 'resource', 'media', 'article', 'announcement')),
  searches integer NOT NULL DEFAULT 0 CHECK (searches >= 0),
  zero_results integer NOT NULL DEFAULT 0 CHECK (zero_results >= 0),
  clicks integer NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX search_analytics_recent_idx ON search_analytics(updated_at DESC);
