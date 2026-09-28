import { NextRequest, NextResponse } from 'next/server';
import { AbortMultipartUploadCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { pool } from '@/lib/db';
import { isUUID } from '@/lib/submissions';
import { s3, videoBucket } from '@/lib/s3';
import { LIBRARY_SELECT, LibraryRow, isNoSuchUpload } from '@/lib/libraryVideos';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Remove a video from the library and from S3. Captures already taken from
 * it keep their own media in video_annotations, so they are unaffected.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!isUUID(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const { rows } = await pool.query<LibraryRow>(
      `SELECT ${LIBRARY_SELECT} FROM library_videos WHERE id = $1::uuid`,
      [id]
    );
    const row = rows[0];
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const bucket = videoBucket();
    if (row.status === 'uploading' && row.upload_id) {
      try {
        await s3.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: row.s3_key, UploadId: row.upload_id }));
      } catch (error) {
        if (!isNoSuchUpload(error)) throw error;
      }
    } else {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: row.s3_key }));
    }
    await pool.query(`DELETE FROM library_videos WHERE id = $1::uuid`, [id]);
    return NextResponse.json({ deleted: id });
  } catch (error: unknown) {
    console.error('library delete failed', error);
    return NextResponse.json({ error: 'Could not remove the video.' }, { status: 500 });
  }
}
