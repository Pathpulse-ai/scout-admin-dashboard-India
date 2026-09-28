import { NextRequest, NextResponse } from 'next/server';
import { UploadPartCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { pool } from '@/lib/db';
import { isUUID } from '@/lib/submissions';
import { PART_URL_TTL_S, s3, videoBucket } from '@/lib/s3';
import { LIBRARY_SELECT, LibraryRow, listUploadedParts, shapeUpload } from '@/lib/libraryVideos';

type RouteContext = { params: Promise<{ id: string }> };

/** Presigned URLs are requested a batch at a time; this caps one batch. */
const MAX_BATCH = 100;

async function openUpload(id: string): Promise<LibraryRow | null> {
  if (!isUUID(id)) return null;
  const { rows } = await pool.query<LibraryRow>(
    `SELECT ${LIBRARY_SELECT} FROM library_videos WHERE id = $1::uuid AND status = 'uploading'`,
    [id]
  );
  return rows[0] ?? null;
}

/**
 * Presigned PUT URLs for the requested part numbers. Signed lazily in
 * batches rather than all at once, because a multi-hour upload would outlive
 * URLs minted at the start.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  let body: { part_numbers?: unknown };
  try {
    body = (await request.json()) as { part_numbers?: unknown };
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 });
  }
  const requested = Array.isArray(body.part_numbers) ? body.part_numbers : [];
  if (requested.length === 0 || requested.length > MAX_BATCH) {
    return NextResponse.json({ error: `part_numbers must hold 1 to ${MAX_BATCH} numbers` }, { status: 400 });
  }

  try {
    const row = await openUpload(id);
    if (!row?.upload_id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { part_count } = shapeUpload(row);

    const numbers = Array.from(new Set(requested.map((n) => Number(n))));
    if (numbers.some((n) => !Number.isInteger(n) || n < 1 || n > part_count)) {
      return NextResponse.json({ error: `part numbers must be between 1 and ${part_count}` }, { status: 400 });
    }

    const bucket = videoBucket();
    const signed = await Promise.all(
      numbers.map(async (partNumber) => [
        partNumber,
        await getSignedUrl(
          s3,
          new UploadPartCommand({ Bucket: bucket, Key: row.s3_key, UploadId: row.upload_id!, PartNumber: partNumber }),
          { expiresIn: PART_URL_TTL_S }
        ),
      ] as const)
    );

    return NextResponse.json({ urls: Object.fromEntries(signed), expires_in: PART_URL_TTL_S });
  } catch (error: unknown) {
    console.error('library part signing failed', error);
    return NextResponse.json({ error: 'Could not sign the upload URLs.' }, { status: 500 });
  }
}

/** What S3 already holds, for a browser resuming after a refresh. */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  try {
    const row = await openUpload(id);
    if (!row?.upload_id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const parts = await listUploadedParts(row.s3_key, row.upload_id);
    return NextResponse.json({ parts });
  } catch (error: unknown) {
    console.error('library list parts failed', error);
    return NextResponse.json({ error: 'Could not read the upload state.' }, { status: 500 });
  }
}
