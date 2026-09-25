import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { isCourtReady, isUUID, reviewStatusFor } from '@/lib/submissions';

type RouteContext = { params: Promise<{ id: string }> };

const ALLOWED = ['verified', 'rejected', 'pending'] as const;

/**
 * Record an officer's decision on one detection.
 *
 * No geographic guard: the review queue serves detections worldwide, and a
 * guard here silently 404'd almost every record while the UI reported success.
 *
 * The RETURNING list is deliberately narrow. The review page merges this
 * response into the case it is already showing, and a full row would clobber
 * the joined username and the media that only the read endpoints assemble.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  if (!isUUID(id)) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }

  const client = await pool.connect();

  try {
    const body = (await request.json()) as {
      status?: string;
      rejection_reason?: string;
      court_ready?: unknown;
    };
    const { status, rejection_reason } = body;
    const courtReady = typeof body.court_ready === 'boolean' ? body.court_ready : null;

    if (!status || !ALLOWED.includes(status as (typeof ALLOWED)[number])) {
      return NextResponse.json(
        { error: 'Invalid status. Must be verified, rejected, or pending.' },
        { status: 400 }
      );
    }

    await client.query('BEGIN');

    const { rows } = await client.query(
      // Both stamps follow the new status, so a validate-then-dismiss cannot
      // leave a rejected record wearing a real verified_at.
      `UPDATE submissions s
       SET verification_status = $1::text,
           rejection_reason = CASE WHEN $1::text = 'rejected' THEN $2::text ELSE NULL END,
           verified_at = CASE WHEN $1::text = 'verified' THEN NOW() ELSE NULL END
       WHERE s.id = $3::uuid
       RETURNING s.id, s.verification_status, s.rejection_reason, s.verified_at`,
      [status, rejection_reason || null, id]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    let reviewStatus: string | null = null;

    if (status === 'verified' && courtReady !== null) {
      // One row per validated case, against its primary frame. A submission
      // with no frames simply has nothing to file.
      const { rows: filed } = await client.query(
        `INSERT INTO submission_image_reviews
                (submission_id, submission_image_id, image_url, review_status)
         SELECT si.submission_id, si.id, si.image_url, $2::varchar
         FROM submission_images si
         WHERE si.submission_id = $1::uuid
         ORDER BY si.is_primary DESC NULLS LAST, si.frame_index ASC
         LIMIT 1
         ON CONFLICT (submission_image_id) DO UPDATE
           SET review_status = EXCLUDED.review_status,
               image_url = EXCLUDED.image_url,
               updated_at = NOW()
         RETURNING review_status`,
        [id, reviewStatusFor(courtReady)]
      );
      reviewStatus = filed[0]?.review_status ?? null;
    } else if (status !== 'verified') {
      // A case that stops being validated loses its filed verdict.
      await client.query(`DELETE FROM submission_image_reviews WHERE submission_id = $1::uuid`, [id]);
    } else {
      const { rows: existing } = await client.query(
        `SELECT review_status FROM submission_image_reviews WHERE submission_id = $1::uuid LIMIT 1`,
        [id]
      );
      reviewStatus = existing[0]?.review_status ?? null;
    }

    await client.query('COMMIT');

    const saved = rows[0];
    return NextResponse.json({
      id: saved.id,
      verification_status: saved.verification_status,
      rejection_reason: saved.rejection_reason,
      verified_at: saved.verified_at,
      review_status: reviewStatus,
      court_ready: isCourtReady(reviewStatus),
    });
  } catch (error: unknown) {
    await client.query('ROLLBACK').catch(() => {});
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
