import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { indiaGeoPredicate } from '@/lib/region';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
    const { id } = await context.params;

    try {
        const { rows } = await pool.query(
            // India means where the detection was captured.
            `SELECT s.*, u.username
             FROM submissions s
             LEFT JOIN users u ON u.id = s.account_id
             WHERE s.id = $1 AND ${indiaGeoPredicate('s')}`,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
        }

        const { rows: images } = await pool.query(
            `SELECT id, frame_index, is_primary, image_url, detection_data
             FROM submission_images
             WHERE submission_id = $1
             ORDER BY frame_index ASC`,
            [id]
        );

        return NextResponse.json({ submission: rows[0], images });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
