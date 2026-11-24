ALTER TABLE link_health_checks ADD COLUMN IF NOT EXISTS elapsed_ms integer CHECK (elapsed_ms IS NULL OR elapsed_ms >= 0);
