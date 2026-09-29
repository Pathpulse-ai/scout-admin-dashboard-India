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

/** Longest class value the schema stores. */
const MAX_CLASS_LENGTH = 255;

/**
 * Change what is on record about a capture: file it as court ready or take
 * that back, and/or move it to another class. Either field alone is enough.
 *
 * A capture is validated evidence the moment it is saved; court ready is the
 * same second decision an officer makes on a scout case, recorded on the same
 * table. Taking it back leaves the capture validated, never unfiled.
 *
 * The class lives on the annotation and is copied onto its filing row, so a
 * change writes both in one transaction; the class filter on the Validated
 * grid reads the annotation, the court-ready counts read the filing.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!isUUID(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: { court_ready?: unknown; detection_type?: unknown };
  try {
    body = (await request.json()) as { court_ready?: unknown; detection_type?: unknown };
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 });
  }

  const hasCourtReady = body.court_ready !== undefined;
  if (hasCourtReady && typeof body.court_ready !== 'boolean') {
    return NextResponse.json({ error: 'court_ready must be true or false' }, { status: 400 });
  }
  const courtReady = hasCourtReady ? (body.court_ready as boolean) : null;

  const hasClass = body.detection_type !== undefined;
  const detectionType =
    typeof body.detection_type === 'string' ? body.detection_type.trim().slice(0, MAX_CLASS_LENGTH) : '';
  if (hasClass && !detectionType) {
    return NextResponse.json({ error: 'detection_type must be a non-empty string' }, { status: 400 });
  }
  if (!hasCourtReady && !hasClass) {
    return NextResponse.json({ error: 'Nothing to update: send court_ready or detection_type' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (hasClass) {
      const { rowCount } = await client.query(
        `UPDATE video_annotations SET detection_type = $2 WHERE id = $1::uuid`,
        [id, detectionType]
      );
      if (!rowCount) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      await client.query(
        `UPDATE submission_image_reviews
         SET detection_type = $2, updated_at = NOW()
         WHERE annotation_id = $1::uuid`,
        [id, detectionType]
      );
    }

    if (courtReady !== null) {
      const { rowCount } = await client.query(
        `UPDATE submission_image_reviews
         SET review_status = $2::varchar, updated_at = NOW()
         WHERE annotation_id = $1::uuid`,
        [id, reviewStatusFor(courtReady)]
      );
      if (!rowCount) {
        // Older captures predate the filing; file one now rather than fail.
        // The class is read back from the annotation, so it is the new one
        // when both fields arrived together.
        const { rowCount: filed } = await client.query(
          `INSERT INTO submission_image_reviews
             (submission_id, annotation_id, image_url, review_status, detection_type, source_kind)
           SELECT NULL, a.id, $2, $3::varchar, a.detection_type,
                  CASE WHEN a.kind = 'frame' THEN 'video_frame' ELSE 'video_clip' END
           FROM video_annotations a
           WHERE a.id = $1::uuid`,
          [id, `/api/annotations/${id}/media`, reviewStatusFor(courtReady)]
        );
        if (!filed) {
          await client.query('ROLLBACK');
          return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
      }
    }

    await client.query('COMMIT');

    const { rows } = await pool.query(
      `SELECT ${ANNOTATION_SELECT} ${ANNOTATION_FROM} WHERE a.id = $1::uuid`,
      [id]
    );
    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ annotation: mapAnnotationRow(rows[0]) });
  } catch (error: unknown) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('annotation update failed', error);
    return NextResponse.json({ error: `Could not update the capture.` }, { status: 500 });
  } finally {
    client.release();
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
