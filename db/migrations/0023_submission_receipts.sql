CREATE TABLE submission_receipts (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  submission_id uuid NOT NULL UNIQUE REFERENCES guest_submissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE guest_submissions ADD COLUMN previous_submission_id uuid REFERENCES guest_submissions(id);

CREATE FUNCTION submission_url_key(value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT regexp_replace(
    regexp_replace(lower(substring(value FROM '^https?://[^/\\?#]+')), ':80$', '') ||
    regexp_replace(split_part(split_part(regexp_replace(value, '^https?://[^/\\?#]+', ''), '#', 1), '?', 1), '/+$', '') ||
    CASE WHEN position('?' IN split_part(value, '#', 1)) > 0 THEN '?' || split_part(split_part(value, '#', 1), '?', 2) ELSE '' END,
    '^(https://[^/:]+):443', '\1');
$$;
CREATE INDEX sites_submission_url_idx ON sites (submission_url_key(target_url)) WHERE status = 'published';
CREATE INDEX resources_submission_url_idx ON resources (submission_url_key(target_url)) WHERE status = 'published';
