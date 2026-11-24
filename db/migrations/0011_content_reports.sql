CREATE TABLE content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL CHECK (content_type IN ('site', 'resource', 'media', 'article')),
  content_id uuid NOT NULL,
  reason text NOT NULL CHECK (reason IN ('broken_link', 'wrong_content', 'spam', 'copyright', 'other')),
  details text NOT NULL DEFAULT '',
  reporter_name text,
  contact_email text,
  client_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX content_reports_queue_idx ON content_reports(status, created_at DESC);
CREATE INDEX content_reports_content_idx ON content_reports(content_type, content_id, created_at DESC);
