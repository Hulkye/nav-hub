CREATE TABLE moderation_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type text NOT NULL CHECK (item_type IN ('submission', 'comment')),
  item_id uuid NOT NULL,
  previous_status text NOT NULL,
  status text NOT NULL,
  note text,
  admin_id uuid REFERENCES admins(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX moderation_reviews_item_idx ON moderation_reviews(item_type, item_id, created_at DESC);
