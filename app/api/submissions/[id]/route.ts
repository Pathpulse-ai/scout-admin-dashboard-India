import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { GEO_VERSION } from '@/lib/region';
import { invalidate } from '@/lib/queryCache';
import {
  isUUID,
  mapSubmissionRow,
  SUBMISSION_SELECT,
  SUBMISSION_IMAGE_COLUMNS,
  SUBMISSION_IMAGE_ORDER,
} from '@/lib/submissions';

type RouteContext = { params: Promise<{ id: string }> };

/** Longest class value the schema stores. */
const MAX_CLASS_LENGTH = 255;

/**
 * Drop every cached figure that names one of these classes.
 *
 * Class totals and the per-class counts are cached for minutes; after a record
 * moves between classes the grid would otherwise show the old class one too
 * many and the new one too few until the TTL ran out. The count and ordered-id
 * caches carry the class quoted inside their JSON parameters, which is what the
 * quoted fragment matches. Batch boundaries are left alone on purpose: a batch
 * is a fixed slice of the class and one row shifts nothing a reviewer relies on.
 */
function dropClassCaches(...types: (string | null)[]) {
  invalidate('detection-types|');
  invalidate('stats:by-type|');
  for (const type of new Set(types.filter((t): t is string => Boolean(t)))) {
    invalidate(`class|${GEO_VERSION}|${type}`);
    invalidate(`"${type}"`);
  }
}

/**
 * One detection, shaped exactly like a row from the list endpoint so the review
 * page can render a deep link without a second code path.
 *
 * There is no geographic guard: the console reviews detections worldwide, and
 * the list endpoint this mirrors has never had one.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  if (!isUUID(id)) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }

  try {
    const { rows } = await pool.query(
      `SELECT ${SUBMISSION_SELECT}
       FROM submissions s
       LEFT JOIN users u ON u.id = s.account_id
       WHERE s.id = $1::uuid`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    const { rows: images } = await pool.query(
      `SELECT ${SUBMISSION_IMAGE_COLUMNS}
       FROM submission_images
       WHERE submission_id = $1::uuid
       ORDER BY ${SUBMISSION_IMAGE_ORDER}`,
      [id]
    );

    const { rows: reviews } = await pool.query(
      `SELECT review_status FROM submission_image_reviews
       WHERE submission_id = $1::uuid LIMIT 1`,
      [id]
    );

    const submission = mapSubmissionRow(rows[0], images, reviews[0]?.review_status ?? null);

    return NextResponse.json({ submission, images });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Move one detection to another class.
 *
 * The class is the only field of a submission the console edits directly; the
 * verdict goes through the verify route. The response is deliberately narrow,
 * like the verify route's: the review page merges it into the record it is
 * already showing, and a full row would clobber the joined username and the
 * media only the read endpoints assemble.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  if (!isUUID(id)) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }

  let body: { detection_type?: unknown };
  try {
    body = (await request.json()) as { detection_type?: unknown };
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 });
  }

  const detectionType =
    typeof body.detection_type === 'string' ? body.detection_type.trim().slice(0, MAX_CLASS_LENGTH) : '';
  if (!detectionType) {
    return NextResponse.json({ error: 'detection_type is required' }, { status: 400 });
  }

  try {
    // The previous class comes back with the row so both classes' caches can
    // be dropped, without a second round trip to read it first.
    const { rows } = await pool.query(
      `WITH before AS (
         SELECT id, detection_type FROM submissions WHERE id = $1::uuid
       )
       UPDATE submissions s
       SET detection_type = $2::text
       FROM before
       WHERE s.id = before.id
       RETURNING s.id, s.detection_type, before.detection_type AS previous_type`,
      [id, detectionType]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    const saved = rows[0] as { id: string; detection_type: string; previous_type: string | null };
    if (saved.previous_type !== saved.detection_type) {
      dropClassCaches(saved.previous_type, saved.detection_type);
    }

    return NextResponse.json({
      id: saved.id,
      detection_type: saved.detection_type,
      previous_type: saved.previous_type,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
