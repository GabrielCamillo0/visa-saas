-- Enum de status
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'submission_status') THEN
CREATE TYPE submission_status AS ENUM ('INTAKE','EXTRACTED','CLASSIFIED','VALIDATING','DECIDED','DELIVERED');
END IF;
END $$;


-- Users
CREATE TABLE IF NOT EXISTS users (
id TEXT PRIMARY KEY,
email TEXT UNIQUE NOT NULL,
name TEXT,
stripe_customer_id TEXT,
created_at timestamptz NOT NULL DEFAULT now()
);


-- Submissions
CREATE TABLE IF NOT EXISTS submissions (
id TEXT PRIMARY KEY,
user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
status submission_status NOT NULL DEFAULT 'INTAKE',
language TEXT NOT NULL DEFAULT 'pt-BR',
raw_text TEXT,
facts JSONB,
initial_hypothesis JSONB,
validation_questions JSONB,
validation_answers JSONB,
final_decision JSONB,
guidance JSONB,
created_at timestamptz NOT NULL DEFAULT now(),
updated_at timestamptz NOT NULL DEFAULT now()
);


-- trigger de updated_at
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END; $$ LANGUAGE plpgsql;


DROP TRIGGER IF EXISTS trg_touch_updated_at ON submissions;
CREATE TRIGGER trg_touch_updated_at
BEFORE UPDATE ON submissions
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();


-- File uploads
CREATE TABLE IF NOT EXISTS file_uploads (
id TEXT PRIMARY KEY,
submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
url TEXT NOT NULL,
type TEXT NOT NULL,
ocr_text TEXT,
meta JSONB,
created_at timestamptz NOT NULL DEFAULT now()
);