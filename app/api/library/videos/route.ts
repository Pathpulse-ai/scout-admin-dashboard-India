import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { LIBRARY_SELECT, LibraryRow, fragmentsByVideo, mapLibraryRow } from '@/lib/libraryVideos';

/**
 * The library: every finished upload, newest first, each with a fresh
 * presigned playback URL.
 */
export async function GET() {
  try {
    // The bucket's lifecycle rule aborts an upload untouched for 7 days, so a
    // row still 'uploading' after 8 has nothing behind it.
    await pool.query(
      `DELETE FROM library_videos WHERE status = 'uploading' AND created_at < now() - INTERVAL '8 days'`
    );

    const { rows } = await pool.query<LibraryRow>(
      `SELECT ${LIBRARY_SELECT} FROM library_videos WHERE status = 'ready' ORDER BY created_at DESC LIMIT 500`
    );
    const fragments = await fragmentsByVideo(rows.map((r) => r.id));
    const videos = await Promise.all(rows.map((r) => mapLibraryRow(r, fragments[r.id] ?? [])));
    return NextResponse.json({ videos });
  } catch (error: unknown) {
    console.error('library list failed', error);
    return NextResponse.json({ error: 'Could not load the video library.' }, { status: 500 });
  }
}
