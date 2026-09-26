import { NextRequest, NextResponse } from 'next/server';

/**
 * Same-origin, range-capable passthrough for a video shared on Google Drive.
 *
 * A pasted share link cannot be read by the browser itself: drive.google.com
 * sends no CORS headers. The multipart uploader therefore reads the file
 * through here, one part-sized Range at a time, and puts each part straight
 * into S3. Every request is short, so a multi-gigabyte import never depends
 * on one long-lived server call.
 *
 * `?probe=1` answers with the file's name, type and size and whether Google
 * honours Range for it, without moving the file.
 *
 * Only a Drive file id is accepted, never a URL, so this cannot be pointed at
 * anything but Google Drive. The file must be shared as "Anyone with the
 * link"; a private file is refused by Google and reported as such.
 *
 * With GOOGLE_API_KEY (or the public NEXT_PUBLIC_GOOGLE_API_KEY) set, the
 * Drive API is used. Without a key the plain download endpoint is used,
 * including the "can't scan for viruses" interstitial Google puts in front
 * of large files.
 */
export const maxDuration = 300;

const FILE_ID = /^[A-Za-z0-9_-]{10,}$/;
const RANGE = /^bytes=(\d+)-(\d+)$/;
const DOWNLOAD_ENDPOINT = 'https://drive.usercontent.google.com/download';
const API_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';

class DriveImportError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const NOT_SHARED =
  'Google Drive refused the download. Share the file as "Anyone with the link" and try again.';

function apiKey(): string {
  return process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '';
}

function isHtml(res: Response): boolean {
  return (res.headers.get('content-type') ?? '').toLowerCase().includes('text/html');
}

/** The filename from a Content-Disposition header, RFC 5987 form first. */
function filenameFrom(disposition: string | null): string | null {
  if (!disposition) return null;
  const encoded = disposition.match(/filename\*=(?:UTF-8|utf-8)''([^;]+)/);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim());
    } catch {
      // fall through to the plain form
    }
  }
  const plain = disposition.match(/filename="?([^";]+)"?/);
  return plain ? plain[1].trim() : null;
}

/** Total size from a 206's Content-Range, else Content-Length. */
function sizeFrom(res: Response): number | null {
  const range = res.headers.get('content-range')?.match(/\/(\d+)$/);
  if (range) return Number(range[1]);
  const length = Number(res.headers.get('content-length'));
  return Number.isFinite(length) && length > 0 ? length : null;
}

async function discard(res: Response) {
  await res.body?.cancel().catch(() => {});
}

interface FileInfo {
  name: string | null;
  type: string | null;
  size: number | null;
  ranges: boolean;
}

// ---------------------------------------------------------------------------
// With an API key: the Drive API, which honours Range and states the size.

const metaCache = new Map<string, { info: FileInfo; expires: number }>();
const CACHE_TTL_MS = 20 * 60 * 1000;

async function apiFileInfo(id: string, key: string): Promise<FileInfo> {
  const cached = metaCache.get(id);
  if (cached && cached.expires > Date.now()) return cached.info;

  const res = await fetch(
    `${API_ENDPOINT}/${encodeURIComponent(id)}?fields=name,mimeType,size&supportsAllDrives=true&key=${encodeURIComponent(key)}`,
    { cache: 'no-store' }
  );
  if (res.status === 404 || res.status === 403) throw new DriveImportError(NOT_SHARED, 403);
  if (!res.ok) throw new DriveImportError(`Google Drive returned ${res.status}.`, 502);
  const meta = (await res.json()) as { name?: string; mimeType?: string; size?: string };
  const info: FileInfo = {
    name: meta.name ?? null,
    type: meta.mimeType ?? null,
    size: Number(meta.size) || null,
    ranges: true,
  };
  metaCache.set(id, { info, expires: Date.now() + CACHE_TTL_MS });
  return info;
}

async function apiFetch(id: string, key: string, range: string | null): Promise<Response> {
  const res = await fetch(
    `${API_ENDPOINT}/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true&key=${encodeURIComponent(key)}`,
    { headers: range ? { range } : {}, cache: 'no-store' }
  );
  if (res.status === 404 || res.status === 403) throw new DriveImportError(NOT_SHARED, 403);
  if (!res.ok) throw new DriveImportError(`Google Drive returned ${res.status}.`, 502);
  return res;
}

// ---------------------------------------------------------------------------
// Without a key: the public download endpoint.

/** Resolved download URLs, so each part does not repeat the interstitial. */
const urlCache = new Map<string, { url: string; expires: number }>();

async function resolveDownloadUrl(id: string): Promise<string> {
  const cached = urlCache.get(id);
  if (cached && cached.expires > Date.now()) return cached.url;

  const params = new URLSearchParams({ id, export: 'download', confirm: 't' });
  let url = `${DOWNLOAD_ENDPOINT}?${params}`;
  const res = await fetch(url, { headers: { range: 'bytes=0-0' }, redirect: 'follow', cache: 'no-store' });

  if (res.ok && isHtml(res)) {
    // The virus-scan interstitial for large files: a form whose hidden inputs
    // carry the confirmation token.
    const html = await res.text();
    const form = new URLSearchParams();
    for (const tag of html.match(/<input\b[^>]*>/gi) ?? []) {
      const name = tag.match(/\bname="([^"]*)"/i)?.[1];
      const value = tag.match(/\bvalue="([^"]*)"/i)?.[1] ?? '';
      if (name) form.set(name, value);
    }
    if (!form.get('id')) throw new DriveImportError(NOT_SHARED, 403);
    const action = html.match(/<form\b[^>]*\baction="([^"]+)"/i)?.[1];
    let target = DOWNLOAD_ENDPOINT;
    if (action) {
      try {
        const parsed = new URL(action, DOWNLOAD_ENDPOINT);
        if (parsed.protocol === 'https:' && parsed.hostname.endsWith('.google.com')) target = parsed.toString();
      } catch {
        // keep the default endpoint
      }
    }
    url = `${target}?${form}`;
  } else {
    await discard(res);
    if (res.status === 403 || res.status === 404) throw new DriveImportError(NOT_SHARED, 403);
    if (!res.ok) throw new DriveImportError(`Google Drive returned ${res.status}.`, 502);
  }

  urlCache.set(id, { url, expires: Date.now() + CACHE_TTL_MS });
  return url;
}

async function linkFetch(id: string, range: string | null): Promise<Response> {
  const url = await resolveDownloadUrl(id);
  const res = await fetch(url, { headers: range ? { range } : {}, redirect: 'follow', cache: 'no-store' });
  if (res.ok && isHtml(res)) {
    await discard(res);
    urlCache.delete(id);
    throw new DriveImportError(NOT_SHARED, 403);
  }
  if (res.status === 403 || res.status === 404) {
    await discard(res);
    urlCache.delete(id);
    throw new DriveImportError(NOT_SHARED, 403);
  }
  if (!res.ok) {
    await discard(res);
    throw new DriveImportError(`Google Drive returned ${res.status}.`, 502);
  }
  return res;
}

async function linkFileInfo(id: string): Promise<FileInfo> {
  const res = await linkFetch(id, 'bytes=0-0');
  const info: FileInfo = {
    name: filenameFrom(res.headers.get('content-disposition')),
    type: (res.headers.get('content-type') ?? '').split(';')[0].trim() || null,
    size: sizeFrom(res),
    ranges: res.status === 206,
  };
  await discard(res);
  return info;
}

// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') ?? '';
  if (!FILE_ID.test(id)) {
    return NextResponse.json({ error: 'A Google Drive file id is required.' }, { status: 400 });
  }
  const probe = searchParams.get('probe') === '1';
  const range = request.headers.get('range');
  if (range && !RANGE.test(range)) {
    return NextResponse.json({ error: 'Range must be bytes=<start>-<end>.' }, { status: 400 });
  }

  try {
    const key = apiKey();

    if (probe) {
      const info = key ? await apiFileInfo(id, key) : await linkFileInfo(id);
      if (info.type && (info.type.startsWith('text/') || info.type === 'application/json')) {
        return NextResponse.json({ error: NOT_SHARED }, { status: 403 });
      }
      return NextResponse.json(info);
    }

    const upstream = key ? await apiFetch(id, key, range) : await linkFetch(id, range);
    const type = (upstream.headers.get('content-type') ?? 'application/octet-stream').split(';')[0].trim().toLowerCase();

    // An HTML or JSON body is an error page, not a video, whatever the status.
    if (type.startsWith('text/') || type === 'application/json') {
      await discard(upstream);
      return NextResponse.json({ error: NOT_SHARED }, { status: 403 });
    }

    const headers = new Headers();
    headers.set('content-type', key ? (metaCache.get(id)?.info.type ?? type) : type);
    for (const name of ['content-length', 'content-range', 'accept-ranges']) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    const name = key ? metaCache.get(id)?.info.name : filenameFrom(upstream.headers.get('content-disposition'));
    if (name) headers.set('x-drive-file-name', encodeURIComponent(name));
    headers.set('cache-control', 'no-store');
    headers.set('x-content-type-options', 'nosniff');

    return new Response(upstream.body, { status: upstream.status === 206 ? 206 : 200, headers });
  } catch (error: unknown) {
    if (error instanceof DriveImportError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('drive import failed', error);
    return NextResponse.json({ error: 'Google Drive could not be reached.' }, { status: 502 });
  }
}
