-- Run once against an existing database, after reviewing and backing up data.
-- This migration aborts if existing claim conflicts need a human decision.
BEGIN;

ALTER TABLE posts ALTER COLUMN management_code TYPE VARCHAR(64);
ALTER TABLE claims ALTER COLUMN tracking_code TYPE VARCHAR(64);
ALTER TABLE claims ALTER COLUMN pickup_code TYPE VARCHAR(64);
ALTER TABLE feedback ALTER COLUMN tracking_code TYPE VARCHAR(64);
ALTER TABLE security_reports ALTER COLUMN tracking_code TYPE VARCHAR(64);

CREATE TABLE IF NOT EXISTS uploaded_images (
    path TEXT PRIMARY KEY,
    bucket TEXT NOT NULL,
    public_url TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS uploaded_images_created_at_idx ON uploaded_images(created_at);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM claims WHERE status IN ('approved', 'completed')
        GROUP BY post_id HAVING COUNT(*) > 1
    ) OR EXISTS (
        SELECT 1 FROM claims WHERE status IN ('pending', 'approved')
        GROUP BY post_id, UPPER(student_id) HAVING COUNT(*) > 1
    ) OR EXISTS (
        SELECT 1 FROM claims WHERE status IN ('pending', 'approved')
        GROUP BY post_id, LOWER(contact) HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Resolve duplicate active or awarded claims before upgrading';
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS claims_one_awarded_per_post_idx
    ON claims(post_id) WHERE status IN ('approved', 'completed');
CREATE UNIQUE INDEX IF NOT EXISTS claims_one_active_student_idx
    ON claims(post_id, UPPER(student_id)) WHERE status IN ('pending', 'approved');
CREATE UNIQUE INDEX IF NOT EXISTS claims_one_active_contact_idx
    ON claims(post_id, LOWER(contact)) WHERE status IN ('pending', 'approved');

UPDATE posts SET category = CASE category
    WHEN 'Sách vở' THEN 'Sách vở & Dụng cụ học tập'
    WHEN 'Phụ kiện' THEN 'Phụ kiện cá nhân'
    ELSE category END,
    location = CASE location
    WHEN 'Tòa A21 - USTH' THEN 'Tòa A21 - USTH Main Building'
    WHEN 'Tòa A11' THEN 'Thư viện A11'
    WHEN 'Tòa A10 - Tầng 4' THEN 'Tòa A10 - CNTT'
    ELSE location END;

-- Keep valid old question objects; remove malformed values that can crash readers.
UPDATE posts p
SET verification_questions = COALESCE((
    SELECT jsonb_agg(q.value ORDER BY q.ordinality)
    FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(p.verification_questions) = 'array'
             THEN p.verification_questions ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS q(value, ordinality)
    WHERE jsonb_typeof(q.value) = 'object'
      AND jsonb_typeof(q.value->'question') = 'string'
      AND length(trim(q.value->>'question')) BETWEEN 1 AND 200
      AND (NOT q.value ? 'hint' OR jsonb_typeof(q.value->'hint') = 'string')
      AND (NOT q.value ? 'required' OR jsonb_typeof(q.value->'required') = 'boolean')
), '[]'::jsonb)
WHERE jsonb_typeof(p.verification_questions) <> 'array'
   OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(p.verification_questions) = 'array'
               THEN p.verification_questions ELSE '[]'::jsonb END
      ) AS q(value)
      WHERE jsonb_typeof(q.value) <> 'object'
         OR jsonb_typeof(q.value->'question') IS DISTINCT FROM 'string'
   );

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_images ENABLE ROW LEVEL SECURITY;

COMMIT;
