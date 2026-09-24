import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { indiaGeoPredicate } from '@/lib/region';

// India means where the detection was captured: submissions.country_code is
// unpopulated, and account country disagrees with the coordinates too often.
const REGION_SCOPE = `
            FROM submissions s
            WHERE ${indiaGeoPredicate('s')}`;

export async function GET() {
    try {
        const [totals, byType] = await Promise.all([
            pool.query(`
            SELECT
                COUNT(*)::int AS total_submissions,
                COUNT(*) FILTER (WHERE s.verification_status = 'verified')::int AS verified,
                COUNT(*) FILTER (WHERE s.verification_status = 'rejected')::int AS rejected,
                COUNT(*) FILTER (WHERE s.verification_status = 'pending')::int AS pending,
                COALESCE(SUM(s.frame_count), 0)::int AS total_frames
            ${REGION_SCOPE}
        `),
            pool.query(`
            SELECT s.detection_type, COUNT(*)::int AS count
            ${REGION_SCOPE}
            GROUP BY s.detection_type
            ORDER BY count DESC
        `),
        ]);

        return NextResponse.json({
            ...totals.rows[0],
            detection_types: byType.rows,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
