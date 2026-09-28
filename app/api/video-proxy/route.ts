import { NextRequest, NextResponse } from 'next/server';

/**
 * Same-origin passthrough for scout videos stored in S3.
 *
 * The bucket is publicly readable but sends no CORS headers, so a <video>
 * pointed straight at it is fine to PLAY but any frame drawn from it onto a
 * canvas is tainted and cannot be exported. Serving the bytes from this origin
 * removes the taint, which is what frame capture and clip recording need.
 *
 * Only the production uploads bucket is allowed, so this cannot be used to
 * fetch arbitrary URLs through the server.
 */
const ALLOWED_HOSTS = new Set(['pathpulse-prod-uploads.s3.ap-south-1.amazonaws.com']);

export async function GET(request: NextRequest) {
  const raw = new URL(request.url).searchParams.get('url');
  if (!raw) return NextResponse.json({ error: 'url is required' }, { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
  }
  if (
    target.protocol !== 'https:' ||
    !ALLOWED_HOSTS.has(target.hostname) ||
    target.port !== '' ||
    target.username !== '' ||
    target.password !== ''
  ) {
    return NextResponse.json({ error: 'Host not allowed' }, { status: 403 });
  }

  // Range is forwarded so the player can seek without downloading everything.
  const headers: Record<string, string> = {};
  const range = request.headers.get('range');
  if (range) headers.range = range;

  let upstream: Response;
  try {
    upstream = await fetch(target, { headers, cache: 'no-store', redirect: 'error' });
  } catch {
    return NextResponse.json({ error: 'Upstream unreachable' }, { status: 502 });
  }
  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json({ error: `Upstream returned ${upstream.status}` }, { status: 502 });
  }

  const out = new Headers();
  for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  out.set('cache-control', 'private, max-age=3600');

  return new Response(upstream.body, { status: upstream.status, headers: out });
}
