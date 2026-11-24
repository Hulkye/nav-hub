CREATE TABLE content_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN ('view', 'outbound_click')),
  content_type text NOT NULL CHECK (content_type IN ('site', 'resource', 'media', 'article', 'announcement')),
  content_id uuid NOT NULL,
  dedupe_key text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX content_events_dedupe_idx ON content_events(event_type, content_type, content_id, dedupe_key);
CREATE INDEX content_events_time_idx ON content_events(occurred_at DESC, event_type, content_type);
