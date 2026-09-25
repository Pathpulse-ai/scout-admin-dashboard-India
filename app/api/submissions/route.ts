import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { indiaGeoPredicate } from '@/lib/region';
import {
  mapSubmissionRow,
  SUBMISSION_SELECT,
  SUBMISSION_IMAGE_COLUMNS,
  SUBMISSION_IMAGE_ORDER,
} from '@/lib/submissions';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function toPositiveInt(raw: string | null, fallback: number, max?: number) {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return typeof max === 'number' ? Math.min(parsed, max) : parsed;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.max(1, toPositiveInt(searchParams.get('limit'), DEFAULT_LIMIT, MAX_LIMIT));
  const offset = toPositiveInt(searchParams.get('offset'), 0);
  const detectionType = searchParams.get('detection_type');
  const status = searchParams.get('verification_status');
  const reviewStatus = searchParams.get('review_status');
  const mediaType = searchParams.get('media_type');
  const username = searchParams.get('username');
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');
  // Counting the filtered set scans millions of rows. A caller that already
  // knows the total (the review page, stepping between windows) opts out.
  const skipCount = searchParams.get('count') === 'skip';

  try {
    const params: (string | number)[] = [];
    // India means where the detection was CAPTURED. The scout account's
    // registered country disagrees with the coordinates too often to use, and
    // submissions.country_code is unpopulated.
    let where = `WHERE ${indiaGeoPredicate('s')}`;

    if (detectionType) {
      params.push(detectionType);
      where += ` AND s.detection_type = $${params.length}`;
    }
    if (status) {
      params.push(status);
      where += ` AND s.verification_status = $${params.length}`;
    }
    if (username) {
      params.push(`%${username}%`);
      where += ` AND u.username ILIKE $${params.length}`;
    }
    if (reviewStatus) {
      // The officer's per-image verdict, filed against the primary frame.
      params.push(reviewStatus);
      where += ` AND EXISTS (
                   SELECT 1 FROM submission_image_reviews r
                   WHERE r.submission_id = s.id
                     AND r.review_status = $${params.length}
                 )`;
    }
    if (mediaType === 'image') {
      where += ` AND EXISTS (SELECT 1 FROM submission_images si WHERE si.submission_id = s.id)`;
    } else if (mediaType === 'video') {
      where += ` AND s.processing_metadata IS NOT NULL
                 AND (
                   (jsonb_typeof(s.processing_metadata) = 'object' AND s.processing_metadata ? 'video_asset')
                   OR (jsonb_typeof(s.processing_metadata) = 'string' AND s.processing_metadata::text ILIKE '%video_asset%')
                 )`;
    }

    // Plain captured_at, not COALESCE(captured_at, created_at): the COALESCE is
    // not indexable, so it forced a full sort of ~2.3M rows and cost ~9s per
    // page. captured_at is NOT NULL on all 2,727,304 rows, so the results are
    // identical and idx_submissions_captured_at now serves the ordering in ~17ms.
    const capturedAt = `s.captured_at`;
    if (dateFrom) {
      params.push(dateFrom.slice(0, 10));
      where += ` AND ${capturedAt} >= $${params.length}::date`;
    }
    if (dateTo) {
      params.push(dateTo.slice(0, 10));
      where += ` AND ${capturedAt} < ($${params.length}::date + INTERVAL '1 day')`;
    }

    const pageQuery = `
      SELECT ${SUBMISSION_SELECT}
      FROM submissions s
      LEFT JOIN users u ON u.id = s.account_id
      ${where}
      ORDER BY ${capturedAt} DESC, s.id ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM submissions s
      LEFT JOIN users u ON u.id = s.account_id
      ${where}
    `;

    const [pageResult, countResult] = await Promise.all([
      pool.query(pageQuery, [...params, limit, offset]),
      skipCount ? Promise.resolve(null) : pool.query(countQuery, params),
    ]);

    const rows = pageResult.rows;
    const total: number | null = skipCount ? null : (countResult?.rows[0]?.total ?? 0);

    const imagesBySubmission: Record<string, Record<string, unknown>[]> = {};
    if (rows.length > 0) {
      const { rows: imageRows } = await pool.query(
        `SELECT ${SUBMISSION_IMAGE_COLUMNS}
         FROM submission_images
         WHERE submission_id = ANY($1)
         ORDER BY submission_id, ${SUBMISSION_IMAGE_ORDER}`,
        [rows.map((r) => r.id)]
      );
      for (const img of imageRows) {
        (imagesBySubmission[img.submission_id] ??= []).push(img);
      }
    }

    // Officer verdicts for this page, filed per primary frame.
    const reviewBySubmission: Record<string, string> = {};
    if (rows.length > 0) {
      const { rows: reviewRows } = await pool.query(
        `SELECT submission_id, review_status
         FROM submission_image_reviews
         WHERE submission_id = ANY($1)`,
        [rows.map((r) => r.id)]
      );
      for (const review of reviewRows) {
        reviewBySubmission[review.submission_id] = review.review_status;
      }
    }

    const submissions = rows.map((row) =>
      mapSubmissionRow(row, imagesBySubmission[row.id] ?? [], reviewBySubmission[row.id] ?? null)
    );

    return NextResponse.json({
      submissions,
      total,
      count: submissions.length,
      limit,
      offset,
      has_more: total === null ? rows.length === limit : offset + rows.length < total,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}