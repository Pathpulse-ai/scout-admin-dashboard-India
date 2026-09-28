-- Video Library fragments: a long recording split into parts for annotation.
--
-- A fragment is a time range of the stored video, not a copy of it: the
-- bytes in S3 are untouched and every part plays the same object, limited to
-- its range. Captures taken from a part are filed against the parent video
-- with the true position in it, so re-splitting never strands them.
--
-- Run once against CORE_DATABASE_URL:
--   psql "$CORE_DATABASE_URL" -f db/migrations/005_library_video_fragments.sql
--
-- Additive and idempotent.

BEGIN;

ALTER TABLE library_videos ADD COLUMN IF NOT EXISTS duration_s numeric(10,3);

CREATE TABLE IF NOT EXISTS library_video_fragments (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id   uuid NOT NULL REFERENCES library_videos(id) ON DELETE CASCADE,
    -- 1-based order within the video.
    position   integer NOT NULL CHECK (position >= 1),
    start_s    numeric(10,3) NOT NULL CHECK (start_s >= 0),
    end_s      numeric(10,3) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (end_s > start_s),
    UNIQUE (video_id, position)
);

CREATE INDEX IF NOT EXISTS idx_library_video_fragments_video ON library_video_fragments (video_id, position);

COMMIT;
