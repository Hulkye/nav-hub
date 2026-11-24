CREATE TABLE link_health_checks (
  content_type text NOT NULL CHECK (content_type IN ('site', 'resource')),
  content_id uuid NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  result_category text NOT NULL CHECK (result_category IN ('pending', 'ignored', 'ok', 'http_error', 'timeout', 'dns_error', 'unsafe_target', 'redirect_error', 'network_error')),
  status_code integer,
  error_summary text,
  ignored_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (content_type, content_id)
);

CREATE INDEX link_health_checks_result_idx ON link_health_checks(result_category, ignored_at, checked_at DESC);
