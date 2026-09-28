import { S3Client } from '@aws-sdk/client-s3';

/**
 * The S3 bucket behind the Video Library.
 *
 * Credentials come from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (or a role,
 * on a host that provides one) through the SDK's default provider chain. The
 * console only ever signs URLs and drives the multipart bookkeeping; the
 * video bytes go straight between the browser and S3.
 */
const globalForS3 = globalThis as unknown as { s3: S3Client | undefined };

export const s3 =
  globalForS3.s3 ??
  new S3Client({
    region: process.env.AWS_REGION || 'ap-south-1',
    // Newer SDKs add checksum headers to every request by default. A presigned
    // part URL would then demand a header the browser does not send, and S3
    // would answer 403. Checksums only where S3 requires them.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });

if (process.env.NODE_ENV !== 'production') {
  globalForS3.s3 = s3;
}

export function videoBucket(): string {
  const bucket = process.env.VIDEO_LIBRARY_BUCKET;
  if (!bucket) throw new Error('VIDEO_LIBRARY_BUCKET is not set');
  return bucket;
}

const MIB = 1024 * 1024;

/**
 * Part sizing.
 *
 * S3 allows at most 10,000 parts and 5 GiB per part. 64 MiB parts keep the
 * per-part overhead small and the memory held by a browser worker bounded;
 * the divisor leaves headroom under the part cap for files past 600 GB.
 */
export const MIN_PART_SIZE = 64 * MIB;
export const MAX_PARTS = 10_000;
/** S3's own ceiling for one object. */
export const MAX_OBJECT_BYTES = 5 * 1024 * 1024 * MIB;

export function partSizeFor(sizeBytes: number): number {
  const needed = Math.ceil(sizeBytes / 9000);
  return Math.max(MIN_PART_SIZE, Math.ceil(needed / MIB) * MIB);
}

export function partCountFor(sizeBytes: number, partSize: number): number {
  return Math.max(1, Math.ceil(sizeBytes / partSize));
}

/** Presigned part URLs are minted in batches as the upload advances. */
export const PART_URL_TTL_S = 60 * 60;
/** A playback URL outlives any one annotation session. */
export const PLAYBACK_URL_TTL_S = 12 * 60 * 60;

/**
 * videos/<yyyy>/<mm>/<id>/<file name>: the id keeps names unique, the date
 * prefixes keep a listing readable, and the original name survives so a
 * download from the console has a sensible filename.
 */
export function objectKeyFor(id: string, fileName: string): string {
  const now = new Date();
  const safe =
    fileName
      .normalize('NFKD')
      .replace(/[^A-Za-z0-9._-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 120) || 'video';
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `videos/${yyyy}/${mm}/${id}/${safe}`;
}

const TYPE_BY_EXTENSION: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/x-m4v',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  mpg: 'video/mpeg',
  mpeg: 'video/mpeg',
  '3gp': 'video/3gpp',
  ogv: 'video/ogg',
  ts: 'video/mp2t',
};

/**
 * The type stored on the object, which S3 sends back on playback. Browsers
 * leave the type empty for some containers, so the extension is the fallback.
 * Null when it is not a video at all.
 */
export function resolveVideoContentType(fileName: string, declared: string): string | null {
  const type = declared.split(';')[0].trim().toLowerCase();
  if (type.startsWith('video/')) return type;
  const ext = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';
  return TYPE_BY_EXTENSION[ext] ?? null;
}
