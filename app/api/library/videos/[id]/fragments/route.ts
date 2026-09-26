import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { isUUID } from '@/lib/submissions';
import { LIBRARY_SELECT, LibraryRow, fragmentsByVideo, mapLibraryRow } from '@/lib/libraryVideos';

type RouteContext = { params: Promise<{ id: string }> };

/** Enough for a 3-hour recording in 5-minute parts; more would be noise. */
const MAX_PARTS = 48;
const MIN_PART_S = 1;

async function readyVideo(id: string): Promise<LibraryRow | null> {
  if (!isUUID(id)) return null;
  const { rows } = await pool.query<LibraryRow>(
    `SELECT ${LIBRARY_SELECT} FROM library_videos WHERE id = $1::uuid AND status = 'ready'`,
    [id]
  );
  return rows[0] ?? null;
}

async function respondWith(row: LibraryRow) {
  const fragments = await fragmentsByVideo([row.id]);
  return NextResponse.json({ video: await mapLibraryRow(row, fragments[row.id] ?? []) });
}

/**
 * Split a video into equal parts, replacing any earlier split.
 *
 * The browser measures the duration (the server never opens the file) and
 * says how many parts it wants. Parts are time ranges of the same stored
 * object; nothing is copied or re-encoded.
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  let body: { parts?: unknown; duration_s?: unknown };
  try {
    body = (await request.json()) as { parts?: unknown; duration_s?: unknown };
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 });
  }
  const parts = Number(body.parts);
  const duration = Number(body.duration_s);
  if (!Number.isInteger(parts) || parts < 2 || parts > MAX_PARTS) {
    return NextResponse.json({ error: `parts must be a whole number from 2 to ${MAX_PARTS}` }, { status: 400 });
  }
  if (!Number.isFinite(duration) || duration <= 0) {
    return NextResponse.json({ error: 'duration_s must be a positive number of seconds' }, { status: 400 });
  }
  if (duration / parts < MIN_PART_S) {
    return NextResponse.json({ error: 'That many parts would be shorter than a second each.' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const row = await readyVideo(id);
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await client.query('BEGIN');
    await client.query(`UPDATE library_videos SET duration_s = $2 WHERE id = $1::uuid`, [id, duration.toFixed(3)]);
    await client.query(`DELETE FROM library_video_fragments WHERE video_id = $1::uuid`, [id]);
    const length = duration / parts;
    for (let position = 1; position <= parts; position++) {
      // The last part ends exactly at the duration, whatever rounding did.
      const start = (position - 1) * length;
      const end = position === parts ? duration : position * length;
      await client.query(
        `INSERT INTO library_video_fragments (video_id, position, start_s, end_s) VALUES ($1::uuid, $2, $3, $4)`,
        [id, position, start.toFixed(3), end.toFixed(3)]
      );
    }
    await client.query('COMMIT');

    const updated = await readyVideo(id);
    return respondWith(updated ?? row);
  } catch (error: unknown) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('library split failed', error);
    return NextResponse.json({ error: 'Could not split the video.' }, { status: 500 });
  } finally {
    client.release();
  }
}

/** Remove the split; the video is whole again and every capture stays. */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  try {
    const row = await readyVideo(id);
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await pool.query(`DELETE FROM library_video_fragments WHERE video_id = $1::uuid`, [id]);
    return respondWith(row);
  } catch (error: unknown) {
    console.error('library unsplit failed', error);
    return NextResponse.json({ error: 'Could not remove the split.' }, { status: 500 });
  }
}
