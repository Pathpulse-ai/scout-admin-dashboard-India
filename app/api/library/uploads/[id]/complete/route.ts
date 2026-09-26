import { NextRequest, NextResponse } from 'next/server';
import { CompleteMultipartUploadCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { pool } from '@/lib/db';
import { isUUID } from '@/lib/submissions';
import { s3, videoBucket } from '@/lib/s3';
import { LIBRARY_SELECT, LibraryRow, mapLibraryRow, shapeUpload } from '@/lib/libraryVideos';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Every part is in: stitch the object together and list the video.
 *
 * S3 only checks that the parts it was told about exist. The size is checked
 * here against what the browser declared, so a truncated upload can never be
 * filed as a complete recording.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!isUUID(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: { parts?: unknown };
  try {
    body = (await request.json()) as { parts?: unknown };
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 });
  }
  const parts = Array.isArray(body.parts)
    ? (body.parts as Array<{ part_number?: unknown; etag?: unknown }>)
        .map((p) => ({ PartNumber: Number(p.part_number), ETag: String(p.etag ?? '') }))
        .filter((p) => Number.isInteger(p.PartNumber) && p.PartNumber >= 1 && p.ETag)
        .sort((a, b) => a.PartNumber - b.PartNumber)
    : [];

  try {
    const { rows } = await pool.query<LibraryRow>(
      `SELECT ${LIBRARY_SELECT} FROM library_videos WHERE id = $1::uuid AND status = 'uploading'`,
      [id]
    );
    const row = rows[0];
    if (!row?.upload_id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { part_count, size_bytes } = shapeUpload(row);
    const distinct = new Set(parts.map((p) => p.PartNumber));
    if (distinct.size !== part_count || parts.some((p) => p.PartNumber > part_count)) {
      return NextResponse.json(
        { error: `Expected ${part_count} parts, received ${distinct.size}.` },
        { status: 400 }
      );
    }

    const bucket = videoBucket();
    let completed;
    try {
      completed = await s3.send(
        new CompleteMultipartUploadCommand({
          Bucket: bucket,
          Key: row.s3_key,
          UploadId: row.upload_id,
          MultipartUpload: { Parts: parts },
        })
      );
    } catch (error) {
      const name = (error as { name?: string })?.name;
      if (name === 'InvalidPart' || name === 'InvalidPartOrder' || name === 'EntityTooSmall') {
        return NextResponse.json({ error: 'S3 rejected the uploaded parts. Retry the upload.' }, { status: 409 });
      }
      throw error;
    }

    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: row.s3_key }));
    if (head.ContentLength !== size_bytes) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: row.s3_key })).catch(() => {});
      await pool.query(`DELETE FROM library_videos WHERE id = $1::uuid`, [id]);
      return NextResponse.json(
        { error: 'The upload finished with the wrong size and was discarded. Try again.' },
        { status: 409 }
      );
    }

    const { rows: ready } = await pool.query<LibraryRow>(
      `UPDATE library_videos
       SET status = 'ready', etag = $2, ready_at = now(), upload_id = NULL, fingerprint = NULL
       WHERE id = $1::uuid
       RETURNING ${LIBRARY_SELECT}`,
      [id, completed.ETag ?? head.ETag ?? null]
    );

    return NextResponse.json({ video: await mapLibraryRow(ready[0]) });
  } catch (error: unknown) {
    console.error('library upload complete failed', error);
    return NextResponse.json({ error: 'Could not finish the upload.' }, { status: 500 });
  }
}
