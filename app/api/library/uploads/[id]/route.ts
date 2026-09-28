import { NextRequest, NextResponse } from 'next/server';
import { AbortMultipartUploadCommand } from '@aws-sdk/client-s3';
import { pool } from '@/lib/db';
import { isUUID } from '@/lib/submissions';
import { s3, videoBucket } from '@/lib/s3';
import { LIBRARY_SELECT, LibraryRow, isNoSuchUpload } from '@/lib/libraryVideos';

type RouteContext = { params: Promise<{ id: string }> };

/** The officer cancelled: drop the parts S3 holds and forget the upload. */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!isUUID(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const { rows } = await pool.query<LibraryRow>(
      `SELECT ${LIBRARY_SELECT} FROM library_videos WHERE id = $1::uuid AND status = 'uploading'`,
      [id]
    );
    const row = rows[0];
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (row.upload_id) {
      try {
        await s3.send(
          new AbortMultipartUploadCommand({ Bucket: videoBucket(), Key: row.s3_key, UploadId: row.upload_id })
        );
      } catch (error) {
        if (!isNoSuchUpload(error)) throw error;
      }
    }
    await pool.query(`DELETE FROM library_videos WHERE id = $1::uuid`, [id]);
    return NextResponse.json({ deleted: id });
  } catch (error: unknown) {
    console.error('library upload abort failed', error);
    return NextResponse.json({ error: 'Could not cancel the upload.' }, { status: 500 });
  }
}
