import { NextRequest, NextResponse } from 'next/server';
import { pool, resolveIndianState, parseJSONMetadata, extractVideoAsset } from '@/lib/db';
import { indiaGeoPredicate } from '@/lib/region';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function toPositiveInt(raw: string | null, fallback: number, max?: number) {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return typeof max === 'number' ? Math.min(parsed, max) : parsed;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.max(1, toPositiveInt(searchParams.get('limit'), DEFAULT_LIMIT, MAX_LIMIT));
  const offset = toPositiveInt(searchParams.get('offset'), 0);
  const detectionType = searchParams.get('detection_type');
  const status = searchParams.get('verification_status');
  const mediaType = searchParams.get('media_type');
  const username = searchParams.get('username');
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');
  const stateFilter = searchParams.get('state');

  try {
    // India means where the detection was captured, not where the scout registered.
    const params: (string | number)[] = [];
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
    if (mediaType === 'image') {
      where += ` AND EXISTS (SELECT 1 FROM submission_images si WHERE si.submission_id = s.id)`;
    } else if (mediaType === 'video') {
      where += ` AND s.processing_metadata IS NOT NULL
                 AND (
                   (jsonb_typeof(s.processing_metadata) = 'object' AND s.processing_metadata ? 'video_asset')
                   OR (jsonb_typeof(s.processing_metadata) = 'string' AND s.processing_metadata::text ILIKE '%video_asset%')
                 )`;
    }

    const capturedAt = `COALESCE(s.captured_at, s.created_at)`;
    if (dateFrom) {
      params.push(dateFrom.slice(0, 10));
      where += ` AND ${capturedAt} >= $${params.length}::date`;
    }
    if (dateTo) {
      params.push(dateTo.slice(0, 10));
      where += ` AND ${capturedAt} < ($${params.length}::date + INTERVAL '1 day')`;
    }

    const pageQuery = `
      SELECT s.*, u.username, u.country_code
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
      pool.query(countQuery, params),
    ]);

    const rows = pageResult.rows;
    const total: number = countResult.rows[0]?.total ?? 0;

    // One batched lookup for every image on the page, primary frame first.
    const imagesBySubmission: Record<string, unknown[]> = {};
    if (rows.length > 0) {
      const { rows: imageRows } = await pool.query(
        `SELECT id, submission_id, frame_index, is_primary, image_url, detection_data
         FROM submission_images
         WHERE submission_id = ANY($1)
         ORDER BY submission_id, is_primary DESC, frame_index ASC`,
        [rows.map((r) => r.id)]
      );
      for (const img of imageRows) {
        (imagesBySubmission[img.submission_id] ??= []).push(img);
      }
    }

    const submissions = rows.map((row) => {
      const processingMetadata = parseJSONMetadata(row.processing_metadata);
      const videoAsset = extractVideoAsset(processingMetadata);
      const images = imagesBySubmission[row.id] ?? [];
      const latitude = toNumber(row.latitude);
      const longitude = toNumber(row.longitude);

      return {
        ...row,
        latitude,
        longitude,
        end_latitude: toNumber(row.end_latitude),
        end_longitude: toNumber(row.end_longitude),
        beats_earned: toNumber(row.beats_earned) ?? 0,
        processing_metadata: processingMetadata,
        video_asset: videoAsset,
        has_video: Boolean(videoAsset),
        has_images: images.length > 0,
        images,
        state: resolveIndianState(latitude ?? NaN, longitude ?? NaN),
      };
    });

    // State is derived in JS, so this filter only narrows the current page.
    const filtered = stateFilter
      ? submissions.filter((s) => s.state.toLowerCase() === stateFilter.toLowerCase())
      : submissions;

    return NextResponse.json({
      submissions: filtered,
      total,
      count: filtered.length,
      limit,
      offset,
      has_more: offset + rows.length < total,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
