-- Fixed slots bound storage without keeping client identifiers or request logs.
CREATE TABLE search_discovery_terms (
  slot integer PRIMARY KEY CHECK (slot >= 0 AND slot < 2048),
  term varchar(120) NOT NULL CHECK (length(term) >= 2),
  searches integer NOT NULL DEFAULT 1 CHECK (searches BETWEEN 1 AND 1000000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX search_discovery_terms_recent_idx ON search_discovery_terms (updated_at DESC);
