CREATE TABLE submission_notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES guest_submissions(id) ON DELETE CASCADE,
  recipient text NOT NULL,
  review_status text NOT NULL CHECK (review_status IN ('approved', 'rejected', 'spam')),
  created_at timestamptz NOT NULL DEFAULT now(),
  handled_at timestamptz,
  handled_by uuid REFERENCES admins(id),
  UNIQUE (submission_id, review_status)
);
CREATE INDEX submission_notification_outbox_pending_idx ON submission_notification_outbox(created_at) WHERE handled_at IS NULL;

CREATE FUNCTION queue_submission_review_notification() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected', 'spam') AND NULLIF(NEW.contact_email, '') IS NOT NULL THEN
    INSERT INTO submission_notification_outbox(submission_id, recipient, review_status)
    VALUES (NEW.id, NEW.contact_email, NEW.status) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER submission_review_notification AFTER UPDATE OF status ON guest_submissions
FOR EACH ROW EXECUTE FUNCTION queue_submission_review_notification();
