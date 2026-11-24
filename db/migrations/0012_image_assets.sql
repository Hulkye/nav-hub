CREATE TABLE image_assets (
  id uuid PRIMARY KEY,
  object_key text NOT NULL UNIQUE,
  filename text NOT NULL,
  content_type text NOT NULL CHECK (content_type = 'image/webp'),
  byte_size integer NOT NULL CHECK (byte_size > 0),
  width integer NOT NULL CHECK (width > 0),
  height integer NOT NULL CHECK (height > 0),
  uploaded_by uuid NOT NULL REFERENCES admins(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX image_assets_created_idx ON image_assets(created_at DESC, id);
