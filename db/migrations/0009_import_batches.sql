CREATE TABLE content_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection text NOT NULL CHECK (collection IN ('sites', 'resources', 'media', 'articles', 'announcements')),
  admin_id uuid REFERENCES admins(id),
  total_rows integer NOT NULL,
  imported_rows integer NOT NULL,
  rejected_rows integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
