ALTER TABLE content_import_batches ADD COLUMN row_results jsonb NOT NULL DEFAULT '[]'::jsonb;
