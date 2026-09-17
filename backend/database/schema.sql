CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(180) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL CHECK (type IN ('lost', 'found')),
    title VARCHAR(180) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(120) NOT NULL,
    location VARCHAR(180) NOT NULL,
    location_detail VARCHAR(220),
    event_date TIMESTAMPTZ NOT NULL,
    image_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'closed', 'hidden')),
    phone VARCHAR(80),
    email VARCHAR(180),
    high_value BOOLEAN NOT NULL DEFAULT FALSE,
    custody_location VARCHAR(220),
    reporter_name VARCHAR(120),
    reporter_role VARCHAR(40),
    verification_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    management_code VARCHAR(64) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    claimer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    student_id VARCHAR(40) NOT NULL,
    contact VARCHAR(180) NOT NULL,
    message TEXT NOT NULL,
    answers JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    tracking_code VARCHAR(64) UNIQUE NOT NULL,
    pickup_code VARCHAR(64) UNIQUE,
    admin_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(180) NOT NULL,
    subject VARCHAR(180) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'resolved')),
    tracking_code VARCHAR(64) UNIQUE NOT NULL,
    admin_reply TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS security_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
    category VARCHAR(80) NOT NULL,
    urgency VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (urgency IN ('normal', 'urgent')),
    location VARCHAR(180) NOT NULL,
    specific_location VARCHAR(220) NOT NULL,
    description TEXT NOT NULL,
    anonymous BOOLEAN NOT NULL DEFAULT FALSE,
    reporter_name VARCHAR(120),
    reporter_contact VARCHAR(180),
    status VARCHAR(30) NOT NULL DEFAULT 'investigating' CHECK (status IN ('investigating', 'patrol_dispatched', 'resolved')),
    tracking_code VARCHAR(64) UNIQUE NOT NULL,
    admin_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS uploaded_images (
    path TEXT PRIMARY KEY,
    bucket TEXT NOT NULL,
    public_url TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS posts_type_status_idx ON posts(type, status);
CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS claims_post_id_idx ON claims(post_id);
CREATE INDEX IF NOT EXISTS claims_claimer_id_idx ON claims(claimer_id);
CREATE UNIQUE INDEX IF NOT EXISTS claims_one_awarded_per_post_idx
    ON claims(post_id) WHERE status IN ('approved', 'completed');
CREATE UNIQUE INDEX IF NOT EXISTS claims_one_active_student_idx
    ON claims(post_id, UPPER(student_id)) WHERE status IN ('pending', 'approved');
CREATE UNIQUE INDEX IF NOT EXISTS claims_one_active_contact_idx
    ON claims(post_id, LOWER(contact)) WHERE status IN ('pending', 'approved');
CREATE INDEX IF NOT EXISTS security_reports_user_id_idx ON security_reports(user_id);
CREATE INDEX IF NOT EXISTS uploaded_images_created_at_idx ON uploaded_images(created_at);

-- The Express backend uses the trusted postgres connection. Do not expose these
-- tables directly through Supabase's anon/authenticated Data API roles.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_images ENABLE ROW LEVEL SECURITY;
