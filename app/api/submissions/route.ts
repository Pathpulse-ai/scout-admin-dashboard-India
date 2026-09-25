import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { GEO_VERSION, indiaGeoPredicate } from '@/lib/region';
import {
  mapSubmissionRow,
  SUBMISSION_SELECT,
  SUBMISSION_IMAGE_COLUMNS,
  SUBMISSION_IMAGE_ORDER,
} from '@/lib/submissions';
import { CLASS_SIZE_TTL_MS, COUNT_TTL_MS, cached } from '@/lib/queryCache';
import { batchPredicate, findBatch } from '@/lib/detectionBatches';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * Below this many rows in a class, the ordered index walk is the WRONG plan.
 *
 * Ordering by captured_at makes Postgres scan that index backwards, testing
 * each row against the class filter. For a class with 66 rows scattered through
 * 2.7M that walk read 326k buffers and took 22 seconds to find 9 matches. A
 * plain filter-then-sort reads the table once and returns the ENTIRE class in
 * 8.5s, so below this threshold we force that plan and fetch the lot.
 */
const RARE_CLASS_ROWS = 5000;

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
  // A named slice of the class, e.g. 'B' for images 5,001-10,000.
  const batchLabelParam = searchParams.get('batch');

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
    // Resolved server-side from the cached boundaries, so the client only ever
    // sends a letter rather than a pair of keyset cursors.
    const batch = await findBatch(detectionType, batchLabelParam);
    if (batch) {
      const { sql, params: batchParams } = batchPredicate(batch, 's', params.length + 1);
      where += sql;
      params.push(...batchParams);
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

    // Inside a batch the answer can never exceed the batch size, so the count
    // is bounded. The LIMIT is what lets Postgres stop early on the index range
    // instead of planning an unbounded aggregate: on with_helmet that is the
    // difference between well under a second and over a minute.
    const countQuery = batch
      ? `
      SELECT COUNT(*)::int AS total FROM (
        SELECT 1
        FROM submissions s
        LEFT JOIN users u ON u.id = s.account_id
        ${where}
        LIMIT ${batch.size}
      ) bounded
    `
      : `
      SELECT COUNT(*)::int AS total
      FROM submissions s
      LEFT JOIN users u ON u.id = s.account_id
      ${where}
    `;

    // The count is identical for every page of the same filter, so it is keyed
    // on the filter alone and survives paging, tab switches and other reviewers.
    const filterKey = `count|${GEO_VERSION}|${where}|${JSON.stringify(params)}`;
    const countPromise = skipCount
      ? Promise.resolve(null)
      : cached(filterKey, COUNT_TTL_MS, async () => {
          const { rows } = await pool.query(countQuery, params);
          return (rows[0]?.total ?? 0) as number;
        });

    // How big is this class? Cached for half an hour and used only to choose a
    // query plan, so a stale value costs nothing worse than the old behaviour.
    let classSize: number | null = null;
    if (detectionType) {
      classSize = await cached(`class|${GEO_VERSION}|${detectionType}`, CLASS_SIZE_TTL_MS, async () => {
        const { rows } = await pool.query(
          `SELECT COUNT(*)::int AS n FROM submissions s
           WHERE ${indiaGeoPredicate('s')} AND s.detection_type = $1`,
          [detectionType]
        );
        return (rows[0]?.n ?? 0) as number;
      });
    }

    const isRareClass = classSize !== null && classSize > 0 && classSize <= RARE_CLASS_ROWS;

    let rows: Record<string, unknown>[];
    let total: number | null;

    if (isRareClass) {
      // A rare class is expensive to ORDER once and cheap to hold. Resolve the
      // whole class to an ordered list of ids ONCE, cache that, then serve
      // every page as a primary-key lookup.
      //
      // MATERIALIZED stops the planner pushing the ORDER BY into the
      // captured_at index, where it would walk hundreds of thousands of rows
      // hunting for a handful of matches: 22s, versus 8.5s to scan and sort.
      const orderedIds = await cached<string[]>(
        `ids|${GEO_VERSION}|${where}|${JSON.stringify(params)}`,
        COUNT_TTL_MS,
        async () => {
          const { rows: idRows } = await pool.query(
            `WITH matched AS MATERIALIZED (
               SELECT s.id, s.captured_at
               FROM submissions s
               LEFT JOIN users u ON u.id = s.account_id
               ${where}
             )
             SELECT id FROM matched
             ORDER BY captured_at DESC, id DESC
             LIMIT ${RARE_CLASS_ROWS}`,
            params
          );
          return idRows.map((r) => r.id as string);
        }
      );

      // The ordered list IS the count, so no separate counting query runs.
      total = skipCount ? null : orderedIds.length;
      const slice = orderedIds.slice(offset, offset + limit);

      if (slice.length === 0) {
        rows = [];
      } else {
        const { rows: pageRows } = await pool.query(
          `SELECT ${SUBMISSION_SELECT}
           FROM submissions s
           LEFT JOIN users u ON u.id = s.account_id
           WHERE s.id = ANY($1::uuid[])
           ORDER BY ${capturedAt} DESC, s.id DESC`,
          [slice]
        );
        rows = pageRows;
      }
    } else {
      const pageQuery = `
        SELECT ${SUBMISSION_SELECT}
        FROM submissions s
        LEFT JOIN users u ON u.id = s.account_id
        ${where}
        ORDER BY ${capturedAt} DESC, s.id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      const [pageResult, countResult] = await Promise.all([
        pool.query(pageQuery, [...params, limit, offset]),
        countPromise,
      ]);
      rows = pageResult.rows;
      total = skipCount ? null : (countResult ?? 0);
    }

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

    const submissions = rows.map((row) => {
      const id = row.id as string;
      return mapSubmissionRow(row, imagesBySubmission[id] ?? [], reviewBySubmission[id] ?? null);
    });

    return NextResponse.json({
      submissions,
      total,
      count: submissions.length,
      limit,
      offset,
      class_size: classSize,
      batch: batch ? { label: batch.label, start_rank: batch.startRank, size: batch.size } : null,
      has_more: total === null ? rows.length === limit : offset + rows.length < total,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}