import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { isUUID, reviewStatusFor } from '@/lib/submissions';
import { ANNOTATION_FROM, ANNOTATION_SELECT, mapAnnotationRow } from '@/lib/annotations';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * One captured frame or clip, shaped like a row from the list endpoint so the
 * review page can open a capture from the grid with the same code path it
 * uses for a scout case.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!isUUID(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const { rows } = await pool.query(
      `SELECT ${ANNOTATION_SELECT} ${ANNOTATION_FROM} WHERE a.id = $1::uuid`,
      [id]
    );
    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ annotation: mapAnnotationRow(rows[0]) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * File a capture as court ready, or take that back.
 *
 * A capture is validated evidence the moment it is saved; this is the same
 * second decision an officer makes on a scout case, recorded on the same
 * table. Taking it back leaves the capture validated, never unfiled.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!isUUID(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: { court_ready?: unknown };
  try {
    body = (await request.json()) as { court_ready?: unknown };
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 });
  }
  if (typeof body.court_ready !== 'boolean') {
    return NextResponse.json({ error: 'court_ready must be true or false' }, { status: 400 });
  }

  try {
    const { rowCount } = await pool.query(
      `UPDATE submission_image_reviews
       SET review_status = $2::varchar, updated_at = NOW()
       WHERE annotation_id = $1::uuid`,
      [id, reviewStatusFor(body.court_ready)]
    );
    if (!rowCount) {
      // Older captures predate the filing; file one now rather than fail.
      const { rowCount: filed } = await pool.query(
        `INSERT INTO submission_image_reviews
           (submission_id, annotation_id, image_url, review_status, detection_type, source_kind)
         SELECT NULL, a.id, $2, $3::varchar, a.detection_type,
                CASE WHEN a.kind = 'frame' THEN 'video_frame' ELSE 'video_clip' END
         FROM video_annotations a
         WHERE a.id = $1::uuid`,
        [id, `/api/annotations/${id}/media`, reviewStatusFor(body.court_ready)]
      );
      if (!filed) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { rows } = await pool.query(
      `SELECT ${ANNOTATION_SELECT} ${ANNOTATION_FROM} WHERE a.id = $1::uuid`,
      [id]
    );
    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ annotation: mapAnnotationRow(rows[0]) });
  } catch (error: unknown) {
    console.error('annotation court-ready update failed', error);
    return NextResponse.json({ error: `Could not update the capture.` }, { status: 500 });
  }
}

/**
 * Remove a captured frame or clip. The matching validated-image row goes with
 * it through ON DELETE CASCADE.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!isUUID(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const { rowCount } = await pool.query(`DELETE FROM video_annotations WHERE id = $1::uuid`, [id]);
    if (!rowCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ deleted: id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
