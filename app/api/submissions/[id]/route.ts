import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import {
  isUUID,
  mapSubmissionRow,
  SUBMISSION_SELECT,
  SUBMISSION_IMAGE_COLUMNS,
  SUBMISSION_IMAGE_ORDER,
} from '@/lib/submissions';

type RouteContext = { params: Promise<{ id: string }> };

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
