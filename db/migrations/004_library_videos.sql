-- Video Library: officer-uploaded videos stored in S3, catalogued here.
--
-- Run once against CORE_DATABASE_URL:
--   psql "$CORE_DATABASE_URL" -f db/migrations/004_library_videos.sql
--
-- Additive and idempotent. The bytes live in the VIDEO_LIBRARY_BUCKET S3
-- bucket; this table is the catalogue and the bookkeeping for an upload in
-- progress, so a multi-gigabyte upload can resume after a refresh.

BEGIN;

CREATE TABLE IF NOT EXISTS library_videos (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name         text         NOT NULL,
    file_name    text         NOT NULL,
    content_type varchar(128) NOT NULL,
    size_bytes   bigint       NOT NULL CHECK (size_bytes > 0),
    s3_key       text         NOT NULL UNIQUE,
    -- 'uploading' until CompleteMultipartUpload succeeds, then 'ready'.
    status       varchar(16)  NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'ready')),
    -- 'device' = chosen from disk, 'drive' = imported from Google Drive.
    source       varchar(16)  NOT NULL DEFAULT 'device' CHECK (source IN ('device', 'drive')),
    upload_id    text,
    part_size    integer,
    -- Identity of the source bytes (name, size, modified time, or a Drive
    -- file id), so picking the same file again resumes the same upload.
    fingerprint  text,
    etag         text,
    created_at   timestamptz  NOT NULL DEFAULT now(),
    ready_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_library_videos_ready ON library_videos (created_at DESC) WHERE status = 'ready';
CREATE INDEX IF NOT EXISTS idx_library_videos_fingerprint ON library_videos (fingerprint) WHERE status = 'uploading';

COMMIT;
