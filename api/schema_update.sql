-- Required tables for the announcement feature

CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY,
    author_id UUID NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    is_global BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.announcement_recipients (
    announcement_id UUID NOT NULL,
    user_id UUID NOT NULL,
    PRIMARY KEY (announcement_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.announcement_files (
    id UUID PRIMARY KEY,
    announcement_id UUID NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT,
    file_size_bytes INTEGER NOT NULL DEFAULT 0,
    storage_path TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_announcement_files_announcement
        FOREIGN KEY (announcement_id)
        REFERENCES public.announcements(id)
        ON DELETE CASCADE
);

-- Optional sample insert for testing
INSERT INTO public.announcements (id, author_id, title, body, is_global, created_at)
VALUES (
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    'Test Announcement',
    'This is a test announcement body.',
    true,
    NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.announcement_files (
    id,
    announcement_id,
    file_name,
    file_type,
    file_size_bytes,
    storage_path,
    uploaded_at
)
VALUES (
    '33333333-3333-4333-8333-333333333333',
    '11111111-1111-4111-8111-111111111111',
    'sample.pdf',
    'application/pdf',
    24567,
    'announcements/sample.pdf',
    NOW()
)
ON CONFLICT (id) DO NOTHING;