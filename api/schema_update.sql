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