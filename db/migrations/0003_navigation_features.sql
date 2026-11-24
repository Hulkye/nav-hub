CREATE TABLE resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '', resource_type text NOT NULL DEFAULT 'software',
  cover_url text, target_url text, status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','offline')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz
);
CREATE TABLE media_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '', media_type text NOT NULL DEFAULT 'book', cover_url text,
  rating numeric(3,1), status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','offline')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz
);
CREATE TABLE articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, slug text NOT NULL UNIQUE,
  summary text NOT NULL DEFAULT '', body text NOT NULL DEFAULT '', cover_url text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','offline')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz
);
CREATE TABLE announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, body text NOT NULL DEFAULT '',
  target_url text, status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','offline')),
  starts_at timestamptz, ends_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE guest_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), content_type text NOT NULL CHECK (content_type IN ('site','resource','media','article')),
  payload jsonb NOT NULL, submitter_name text, contact_email text, status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','spam')),
  review_note text, published_content_id uuid, ip_hash text, created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz
);
CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), content_type text NOT NULL, content_id uuid NOT NULL,
  display_name text NOT NULL, email text, body text NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','spam')),
  ip_hash text, created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz
);
CREATE INDEX guest_submissions_status_idx ON guest_submissions(status, created_at DESC);
CREATE INDEX comments_content_idx ON comments(content_type, content_id, status, created_at DESC);
