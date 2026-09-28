import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { CreateMultipartUploadCommand } from '@aws-sdk/client-s3';
import { pool } from '@/lib/db';
import {
  MAX_OBJECT_BYTES,
  objectKeyFor,
  partSizeFor,
  resolveVideoContentType,
  s3,
  videoBucket,
} from '@/lib/s3';
import {
  LIBRARY_SELECT,
  LibraryRow,
  isNoSuchUpload,
  listUploadedParts,
  shapeUpload,
} from '@/lib/libraryVideos';

/**
 * Begin (or resume) a multipart upload into the Video Library.
 *
 * The browser sends only the file's description; the bytes go straight to
 * S3 through presigned part URLs. A `fingerprint` names the source bytes
 * (file name, size and modified time, or a Drive file id): if an upload of
 * the same bytes is still open, its parts are returned and the browser
 * carries on from there instead of starting over.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 });
  }

  const name = String(body.name ?? '').trim().slice(0, 120);
  const fileName = String(body.file_name ?? '').trim().slice(0, 255);
  const size = Number(body.size_bytes);
  const source = body.source === 'drive' ? 'drive' : 'device';
  const fingerprint = typeof body.fingerprint === 'string' ? body.fingerprint.slice(0, 512) : null;
  const contentType = resolveVideoContentType(fileName, String(body.content_type ?? ''));

  if (!name) return NextResponse.json({ error: 'Give the video a name.' }, { status: 400 });
  if (!fileName) return NextResponse.json({ error: 'file_name is required' }, { status: 400 });
  if (!Number.isInteger(size) || size <= 0) {
    return NextResponse.json({ error: 'size_bytes must be a positive integer' }, { status: 400 });
  }
  if (size > MAX_OBJECT_BYTES) return NextResponse.json({ error: 'The file is larger than S3 allows.' }, { status: 413 });
  if (!contentType) return NextResponse.json({ error: 'Only video files can be uploaded.' }, { status: 415 });

  try {
    if (fingerprint) {
      const { rows } = await pool.query<LibraryRow>(
        `SELECT ${LIBRARY_SELECT} FROM library_videos
         WHERE fingerprint = $1 AND status = 'uploading' AND size_bytes = $2
         ORDER BY created_at DESC LIMIT 1`,
        [fingerprint, size]
      );
      const pending = rows[0];
      if (pending?.upload_id) {
        try {
          const parts = await listUploadedParts(pending.s3_key, pending.upload_id);
          return NextResponse.json({ upload: shapeUpload(pending), uploaded_parts: parts, resumed: true });
        } catch (error) {
          if (!isNoSuchUpload(error)) throw error;
          // The lifecycle rule aborted it days ago; forget it and start fresh.
          await pool.query(`DELETE FROM library_videos WHERE id = $1`, [pending.id]);
        }
      }
    }

    const id = randomUUID();
    const key = objectKeyFor(id, fileName);
    const partSize = partSizeFor(size);

    const created = await s3.send(
      new CreateMultipartUploadCommand({
        Bucket: videoBucket(),
        Key: key,
        ContentType: contentType,
        // Straight into the tiered class, so the lifecycle rule has nothing to move.
        StorageClass: 'INTELLIGENT_TIERING',
      })
    );
    if (!created.UploadId) throw new Error('S3 returned no upload id');

    const { rows } = await pool.query<LibraryRow>(
      `INSERT INTO library_videos
         (id, name, file_name, content_type, size_bytes, s3_key, status, source, upload_id, part_size, fingerprint)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, 'uploading', $7, $8, $9, $10)
       RETURNING ${LIBRARY_SELECT}`,
      [id, name, fileName, contentType, size, key, source, created.UploadId, partSize, fingerprint]
    );

    return NextResponse.json({ upload: shapeUpload(rows[0]), uploaded_parts: [], resumed: false });
  } catch (error: unknown) {
    console.error('library upload begin failed', error);
    return NextResponse.json({ error: 'Could not start the upload. Check the S3 configuration.' }, { status: 500 });
  }
}
