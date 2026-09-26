import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { REVIEW_VALIDATED } from '@/lib/submissions';
import { isUUID } from '@/lib/submissions';
import { ANNOTATION_FROM, ANNOTATION_SELECT, mapAnnotationRow } from '@/lib/annotations';

/**
 * Frames and clips an officer captured from a video and labelled.
 *
 * A save writes two rows in one transaction: the media itself into
 * video_annotations, and a matching "validated image" entry into
 * submission_image_reviews so the capture sits alongside officer verdicts on
 * scout frames. Un-doing one removes both, through ON DELETE CASCADE.
 */
const MAX_BYTES = 25 * 1024 * 1024;
const KINDS = new Set(['frame', 'clip']);
const SOURCES = new Set(['library', 'submission']);

/**
 * Only real image and video types are stored and served. The type is taken
 * from the upload and served back inline from this origin, so anything else
 * (text/html above all) would be a stored script running as the officer.
 */
const ALLOWED_TYPES: Record<string, Set<string>> = {
  frame: new Set(['image/jpeg', 'image/png', 'image/webp']),
  clip: new Set(['video/webm', 'video/mp4']),
};

function toSeconds(value: FormDataEntryValue | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) / 1000 : null;
}

/**
 * The Validated grid lists every capture that matches its filters in one
 * request and merges them into the scout cases by time, so the cap is the
 * whole working set rather than a page. Metadata only: about 300 bytes a row.
 */
const MAX_LIMIT = 500;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(searchParams.get('limit') ?? '50', 10) || 50));
  const sourceVideoId = searchParams.get('source_video_id');
  // The Validated tab passes its own class and time filters through, so the
  // annotation section there agrees with the scout cases beside it.
  const detectionType = searchParams.get('detection_type');
  const dateFrom = searchParams.get('date_from');
  // The Court ready tab asks for the captures filed as court ready.
  const reviewStatus = searchParams.get('review_status');

  try {
    const params: (string | number)[] = [limit];
    const clauses: string[] = [];
    if (sourceVideoId) {
      params.push(sourceVideoId);
      clauses.push(`a.source_video_id = $${params.length}`);
    }
    if (detectionType) {
      params.push(detectionType);
      clauses.push(`a.detection_type = $${params.length}`);
    }
    if (reviewStatus) {
      params.push(reviewStatus);
      clauses.push(`r.review_status = $${params.length}`);
    }
    if (dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
      params.push(dateFrom);
      clauses.push(`a.created_at >= $${params.length}::date`);
    }
    // A split video's part lists only the captures inside its time range:
    // from its start up to, but not including, its end, so a capture on the
    // boundary belongs to exactly one part.
    const timeFrom = Number(searchParams.get('time_from'));
    const timeTo = Number(searchParams.get('time_to'));
    if (searchParams.has('time_from') && Number.isFinite(timeFrom)) {
      params.push(timeFrom);
      clauses.push(`a.video_time_s >= $${params.length}`);
    }
    if (searchParams.has('time_to') && Number.isFinite(timeTo)) {
      params.push(timeTo);
      clauses.push(`a.video_time_s < $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    // Never select the bytes here; the list is metadata only.
    const { rows } = await pool.query(
      `SELECT ${ANNOTATION_SELECT}
       ${ANNOTATION_FROM}
       ${where}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT $1`,
      params
    );

    return NextResponse.json({ annotations: rows.map(mapAnnotationRow) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Refuse oversized bodies BEFORE buffering them: route handlers have no body
  // limit of their own, so the post-parse check alone would let one request
  // allocate its full size first. Browsers always send Content-Length for
  // FormData bodies.
  const declared = Number(request.headers.get('content-length'));
  if (!Number.isFinite(declared) || declared <= 0) {
    return NextResponse.json({ error: 'content-length is required' }, { status: 411 });
  }
  if (declared > MAX_BYTES + 64 * 1024) {
    return NextResponse.json({ error: `media exceeds ${MAX_BYTES / 1024 / 1024} MB` }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
  }

  const media = form.get('media');
  const kind = String(form.get('kind') ?? '');
  const detectionType = String(form.get('detection_type') ?? '').trim().slice(0, 255);
  const sourceKind = String(form.get('source_kind') ?? '');
  const sourceVideoId = form.get('source_video_id') ? String(form.get('source_video_id')) : null;
  const sourceSubmissionRaw = form.get('source_submission_id');
  const sourceSubmissionId = sourceSubmissionRaw ? String(sourceSubmissionRaw) : null;
  const sourceName = form.get('source_name') ? String(form.get('source_name')).slice(0, 255) : null;
  const videoTime = toSeconds(form.get('video_time_s'));
  const clipStart = toSeconds(form.get('clip_start_s'));
  const clipEnd = toSeconds(form.get('clip_end_s'));

  if (!(media instanceof File) || media.size === 0) {
    return NextResponse.json({ error: 'media file is required' }, { status: 400 });
  }
  if (media.size > MAX_BYTES) {
    return NextResponse.json({ error: `media exceeds ${MAX_BYTES / 1024 / 1024} MB` }, { status: 413 });
  }
  if (!KINDS.has(kind)) return NextResponse.json({ error: 'kind must be frame or clip' }, { status: 400 });
  if (!detectionType) return NextResponse.json({ error: 'detection_type is required' }, { status: 400 });
  if (!SOURCES.has(sourceKind)) {
    return NextResponse.json({ error: 'source_kind must be library or submission' }, { status: 400 });
  }
  if (videoTime === null) return NextResponse.json({ error: 'video_time_s is required' }, { status: 400 });
  if (kind === 'clip' && (clipStart === null || clipEnd === null || clipEnd <= clipStart)) {
    return NextResponse.json({ error: 'a clip needs clip_start_s < clip_end_s' }, { status: 400 });
  }
  if (sourceSubmissionId && !isUUID(sourceSubmissionId)) {
    return NextResponse.json({ error: 'source_submission_id must be a uuid' }, { status: 400 });
  }

  const contentType = (media.type || '').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_TYPES[kind].has(contentType)) {
    return NextResponse.json({ error: 'unsupported media type' }, { status: 415 });
  }

  const bytes = Buffer.from(await media.arrayBuffer());

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO video_annotations
         (kind, detection_type, source_kind, source_video_id, source_submission_id, source_name,
          video_time_s, clip_start_s, clip_end_s, content_type, byte_size, media)
       VALUES ($1, $2, $3, $4, $5::uuid, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, kind, detection_type, source_kind, source_name, video_time_s,
                 clip_start_s, clip_end_s, content_type, byte_size, created_at`,
      [
        kind,
        detectionType,
        sourceKind,
        sourceVideoId,
        sourceSubmissionId,
        sourceName,
        videoTime,
        kind === 'clip' ? clipStart : null,
        kind === 'clip' ? clipEnd : null,
        contentType,
        bytes.length,
        bytes,
      ]
    );
    const saved = rows[0];

    // Filed as a validated image, next to officer verdicts on scout frames.
    // submission_id is deliberately NULL: readers treat a review row keyed on
    // a submission as that case's own verdict, so linking it here would let a
    // captured frame overwrite a COURT_READY case's status. The link to the
    // scout video is kept in video_annotations.source_submission_id.
    await client.query(
      `INSERT INTO submission_image_reviews
         (submission_id, annotation_id, image_url, review_status, detection_type, source_kind)
       VALUES (NULL, $1::uuid, $2, $3, $4, $5)`,
      [
        saved.id,
        `/api/annotations/${saved.id}/media`,
        REVIEW_VALIDATED,
        detectionType,
        kind === 'frame' ? 'video_frame' : 'video_clip',
      ]
    );

    await client.query('COMMIT');

    // Read it back through the shared select so the response carries the same
    // fields (scout, review status) as a row from the list.
    const { rows: fullRows } = await pool.query(
      `SELECT ${ANNOTATION_SELECT} ${ANNOTATION_FROM} WHERE a.id = $1::uuid`,
      [saved.id]
    );
    const annotation = fullRows[0]
      ? mapAnnotationRow(fullRows[0])
      : mapAnnotationRow({ ...saved, source_video_id: sourceVideoId, source_submission_id: sourceSubmissionId, review_status: REVIEW_VALIDATED });

    return NextResponse.json({ annotation });
  } catch (error: unknown) {
    await client.query('ROLLBACK').catch(() => {});
    // Constraint and driver text stays in the server log; the page shows a
    // plain message rather than internals.
    console.error('annotation save failed', error);
    return NextResponse.json({ error: 'Could not save the capture.' }, { status: 500 });
  } finally {
    client.release();
  }
}
