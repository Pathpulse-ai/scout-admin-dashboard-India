import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { isUUID } from '@/lib/submissions';

type RouteContext = { params: Promise<{ id: string }> };

/** The captured frame or clip itself. */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!isUUID(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const { rows } = await pool.query(
      `SELECT kind, content_type, byte_size, media FROM video_annotations WHERE id = $1::uuid`,
      [id]
    );
    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const row = rows[0];
    const body = row.media as Buffer;
    const type = String(row.content_type);
    const ext =
      ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/webm': 'webm', 'video/mp4': 'mp4' } as Record<string, string>)[type]
      ?? (row.kind === 'frame' ? 'jpg' : 'webm');

    return new Response(new Uint8Array(body), {
      status: 200,
      headers: {
        'content-type': type,
        'content-length': String(body.length),
        // Never let a browser second-guess the type of stored bytes.
        'x-content-type-options': 'nosniff',
        // Media never changes once saved, so it can be cached hard.
        'cache-control': 'private, max-age=31536000, immutable',
        'content-disposition': `inline; filename="annotation-${id}.${ext}"`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
