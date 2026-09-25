import { parseJSONMetadata, extractVideoAsset } from './db';

/** Postgres raises 22P02 on a malformed uuid, which would surface as a 500. */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUUID(value: string | null | undefined): boolean {
  return UUID_PATTERN.test(value ?? '');
}

/**
 * `s.*` and `u.country_code` collide, and node-postgres keeps the LAST field of
 * a duplicated name. Spelling the fallback out keeps the intent on the page.
 */
export const SUBMISSION_SELECT = `s.*,
          u.username,
          COALESCE(u.country_code, s.country_code) AS country_code`;

export const SUBMISSION_IMAGE_COLUMNS = `id, submission_id, frame_index, is_primary, image_url, thumbnail_url, detection_data`;

/**
 * DESC defaults to NULLS FIRST in Postgres, which would sort a row with a null
 * `is_primary` ahead of the genuinely primary frame.
 */
export const SUBMISSION_IMAGE_ORDER = `is_primary DESC NULLS LAST, frame_index ASC`;

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

type Row = Record<string, unknown>;

/**
 * The officer's per-image verdict, recorded in `submission_image_reviews`.
 *
 * A validated case writes one row for its primary frame: COURT_READY when the
 * frame can stand as evidence, VALIDATED when the case is sound but the frame
 * is not. Un-validating a case removes the row.
 *
 * This is deliberately NOT `layer1_image_validation`. That table belongs to the
 * automated quality pipeline, whose workers own `layer1_decision` and update
 * rows continuously; officer decisions there would overwrite machine verdicts.
 */
export const REVIEW_COURT_READY = 'COURT_READY';
export const REVIEW_VALIDATED = 'VALIDATED';

export type ReviewStatus = typeof REVIEW_COURT_READY | typeof REVIEW_VALIDATED;

export function reviewStatusFor(courtReady: boolean): ReviewStatus {
  return courtReady ? REVIEW_COURT_READY : REVIEW_VALIDATED;
}

export function isCourtReady(reviewStatus: string | null | undefined): boolean | null {
  if (reviewStatus === REVIEW_COURT_READY) return true;
  if (reviewStatus === REVIEW_VALIDATED) return false;
  return null;
}

/**
 * One row of `submissions` shaped for the client: numerics coerced off pg's
 * strings, metadata parsed, and the playable clip lifted out of it.
 */
export function mapSubmissionRow(
  row: Row,
  images: Row[] = [],
  reviewStatus: string | null = null
) {
  const processingMetadata = parseJSONMetadata(row.processing_metadata);
  const videoAsset = extractVideoAsset(processingMetadata);

  return {
    ...row,
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
    end_latitude: toNumber(row.end_latitude),
    end_longitude: toNumber(row.end_longitude),
    beats_earned: toNumber(row.beats_earned) ?? 0,
    frame_count: toNumber(row.frame_count) ?? images.length,
    processing_metadata: processingMetadata,
    review_status: reviewStatus,
    court_ready: isCourtReady(reviewStatus),
    video_asset: videoAsset,
    has_video: Boolean(videoAsset),
    has_images: images.length > 0,
    images,
  };
}
