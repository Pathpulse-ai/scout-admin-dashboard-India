-- Video annotation: frames and clips captured by an officer from a video,
-- labelled with a detection class and filed as validated images.
--
-- Run once against CORE_DATABASE_URL:
--   psql "$CORE_DATABASE_URL" -f db/migrations/002_video_annotations.sql
--
-- Additive and idempotent. Media is stored in Postgres (bytea) because the
-- console has no object-storage credentials and deploys to a read-only
-- filesystem; a 20-second clip is a few megabytes, well within reason.

BEGIN;

CREATE TABLE IF NOT EXISTS video_annotations (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kind                 varchar(16)  NOT NULL CHECK (kind IN ('frame', 'clip')),
    detection_type       varchar(255) NOT NULL,
    -- 'library' = a video uploaded on the Video upload page (browser library),
    -- 'submission' = a scout's video already in submissions.
    source_kind          varchar(16)  NOT NULL CHECK (source_kind IN ('library', 'submission')),
    source_video_id      text,
    source_submission_id uuid REFERENCES submissions(id) ON DELETE SET NULL,
    source_name          text,
    -- Where the key was pressed, in seconds from the start of the video.
    video_time_s         numeric(10,3) NOT NULL,
    clip_start_s         numeric(10,3),
    clip_end_s           numeric(10,3),
    content_type         varchar(64)  NOT NULL,
    byte_size            integer      NOT NULL,
    media                bytea        NOT NULL,
    created_at           timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_video_annotations_created ON video_annotations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_annotations_type    ON video_annotations (detection_type);

-- Annotations are filed into the same "validated images" table as officer
-- verdicts on scout frames. A row now points at EITHER a submission image OR
-- an annotation, never both and never neither.
ALTER TABLE submission_image_reviews ALTER COLUMN submission_id       DROP NOT NULL;
ALTER TABLE submission_image_reviews ALTER COLUMN submission_image_id DROP NOT NULL;
ALTER TABLE submission_image_reviews
    ADD COLUMN IF NOT EXISTS annotation_id  uuid REFERENCES video_annotations(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS detection_type varchar(255),
    ADD COLUMN IF NOT EXISTS source_kind    varchar(32) NOT NULL DEFAULT 'submission_image';

CREATE UNIQUE INDEX IF NOT EXISTS submission_image_reviews_annotation_key
    ON submission_image_reviews (annotation_id) WHERE annotation_id IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'submission_image_reviews_one_source'
    ) THEN
        ALTER TABLE submission_image_reviews ADD CONSTRAINT submission_image_reviews_one_source
            CHECK (
                (submission_image_id IS NOT NULL AND annotation_id IS NULL)
             OR (submission_image_id IS NULL     AND annotation_id IS NOT NULL)
            );
    END IF;
END $$;

COMMIT;
