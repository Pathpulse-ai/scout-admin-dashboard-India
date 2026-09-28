import { GetObjectCommand, ListPartsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PLAYBACK_URL_TTL_S, partCountFor, s3, videoBucket } from './s3';
import { pool } from './db';
import { LibraryFragmentRecord, LibraryVideoRecord } from '@/types';

/** Server-side shaping of library_videos rows, shared by every route. */

export const LIBRARY_SELECT = `id, name, file_name, content_type, size_bytes, s3_key, status, source,
          upload_id, part_size, fingerprint, etag, duration_s, created_at, ready_at`;

export type LibraryRow = {
  id: string;
  name: string;
  file_name: string;
  content_type: string;
  size_bytes: string | number;
  s3_key: string;
  status: 'uploading' | 'ready';
  source: 'device' | 'drive';
  upload_id: string | null;
  part_size: number | null;
  fingerprint: string | null;
  etag: string | null;
  duration_s: string | number | null;
  created_at: string;
  ready_at: string | null;
};

/** The parts of each listed video, in order, keyed by video id. */
export async function fragmentsByVideo(videoIds: string[]): Promise<Record<string, LibraryFragmentRecord[]>> {
  const byVideo: Record<string, LibraryFragmentRecord[]> = {};
  if (videoIds.length === 0) return byVideo;
  const { rows } = await pool.query(
    `SELECT id, video_id, position, start_s, end_s
     FROM library_video_fragments
     WHERE video_id = ANY($1::uuid[])
     ORDER BY video_id, position`,
    [videoIds]
  );
  for (const r of rows) {
    (byVideo[r.video_id as string] ??= []).push({
      id: r.id as string,
      position: Number(r.position),
      start_s: Number(r.start_s),
      end_s: Number(r.end_s),
    });
  }
  return byVideo;
}

export async function signPlaybackUrl(key: string): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: videoBucket(), Key: key }), {
    expiresIn: PLAYBACK_URL_TTL_S,
  });
}

/** A ready video for the client, with a fresh playback URL. */
export async function mapLibraryRow(
  row: LibraryRow,
  fragments: LibraryFragmentRecord[] = []
): Promise<LibraryVideoRecord> {
  const duration = row.duration_s === null || row.duration_s === undefined ? null : Number(row.duration_s);
  return {
    id: row.id,
    name: row.name,
    file_name: row.file_name,
    content_type: row.content_type,
    size_bytes: Number(row.size_bytes),
    source: row.source,
    duration_s: Number.isFinite(duration) ? duration : null,
    fragments,
    created_at: row.created_at,
    ready_at: row.ready_at,
    url: row.status === 'ready' ? await signPlaybackUrl(row.s3_key) : null,
  };
}

/** The bookkeeping the browser needs to drive (or resume) a multipart upload. */
export function shapeUpload(row: LibraryRow) {
  const size = Number(row.size_bytes);
  const partSize = row.part_size ?? size;
  return {
    id: row.id,
    key: row.s3_key,
    upload_id: row.upload_id,
    part_size: partSize,
    part_count: partCountFor(size, partSize),
    size_bytes: size,
    name: row.name,
    file_name: row.file_name,
    content_type: row.content_type,
  };
}

export interface UploadedPart {
  part_number: number;
  etag: string;
  size: number;
}

/** Every part S3 already holds for an upload, across ListParts pages. */
export async function listUploadedParts(key: string, uploadId: string): Promise<UploadedPart[]> {
  const parts: UploadedPart[] = [];
  let marker: number | undefined;
  for (;;) {
    const page = await s3.send(
      new ListPartsCommand({ Bucket: videoBucket(), Key: key, UploadId: uploadId, PartNumberMarker: marker ? String(marker) : undefined, MaxParts: 1000 })
    );
    for (const p of page.Parts ?? []) {
      if (p.PartNumber && p.ETag) parts.push({ part_number: p.PartNumber, etag: p.ETag, size: p.Size ?? 0 });
    }
    if (!page.IsTruncated || !page.NextPartNumberMarker) break;
    marker = Number(page.NextPartNumberMarker);
  }
  return parts;
}

/** S3 says this when the lifecycle rule has already aborted an old upload. */
export function isNoSuchUpload(error: unknown): boolean {
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === 'NoSuchUpload' || e?.$metadata?.httpStatusCode === 404;
}
