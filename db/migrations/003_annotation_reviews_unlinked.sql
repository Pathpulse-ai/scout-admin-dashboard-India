-- Annotation filings must not carry a scout submission id.
--
-- Every existing reader of submission_image_reviews keyed on submission_id
-- treats that row as the case's own verdict, so a frame captured from a scout
-- video would silently overwrite that case's COURT_READY status. Provenance
-- stays in video_annotations.source_submission_id.
--
-- Run once against CORE_DATABASE_URL:
--   psql "$CORE_DATABASE_URL" -f db/migrations/003_annotation_reviews_unlinked.sql

BEGIN;

UPDATE submission_image_reviews SET submission_id = NULL WHERE annotation_id IS NOT NULL;

ALTER TABLE submission_image_reviews DROP CONSTRAINT IF EXISTS submission_image_reviews_one_source;
ALTER TABLE submission_image_reviews ADD CONSTRAINT submission_image_reviews_one_source
    CHECK (
        (submission_image_id IS NOT NULL AND annotation_id IS NULL)
     OR (submission_image_id IS NULL AND annotation_id IS NOT NULL AND submission_id IS NULL)
    );

-- The list filters on source_video_id; give it an index.
CREATE INDEX IF NOT EXISTS idx_video_annotations_source_video ON video_annotations (source_video_id);

COMMIT;
