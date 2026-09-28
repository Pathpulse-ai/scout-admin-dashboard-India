/**
 * Server-side shape of a Video annotation row for the API.
 *
 * Shared by the list, the single-record and the save routes so every caller
 * gets the same fields, including the scout the source video belongs to when
 * it was a scout's video.
 */

export const ANNOTATION_SELECT = `a.id, a.kind, a.detection_type, a.source_kind, a.source_video_id,
          a.source_submission_id, a.source_name, a.video_time_s, a.clip_start_s,
          a.clip_end_s, a.content_type, a.byte_size, a.created_at,
          r.review_status,
          u.username AS source_username,
          COALESCE(u.country_code, s.country_code) AS source_country_code,
          s.latitude AS source_latitude,
          s.longitude AS source_longitude`;

/** The unique partial index on annotation_id makes the review join 1:1. */
export const ANNOTATION_FROM = `FROM video_annotations a
       LEFT JOIN submission_image_reviews r ON r.annotation_id = a.id
       LEFT JOIN submissions s ON s.id = a.source_submission_id
       LEFT JOIN users u ON u.id = s.account_id`;

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Numerics arrive from pg as strings; the media URL is derived, never stored. */
export function mapAnnotationRow(row: Record<string, unknown>) {
  return {
    ...row,
    video_time_s: toNumber(row.video_time_s) ?? 0,
    clip_start_s: toNumber(row.clip_start_s),
    clip_end_s: toNumber(row.clip_end_s),
    byte_size: toNumber(row.byte_size) ?? 0,
    review_status: (row.review_status as string | null) ?? null,
    source_username: (row.source_username as string | null) ?? null,
    source_country_code: (row.source_country_code as string | null) ?? null,
    source_latitude: toNumber(row.source_latitude),
    source_longitude: toNumber(row.source_longitude),
    media_url: `/api/annotations/${row.id}/media`,
  };
}
