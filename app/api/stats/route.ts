import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { indiaGeoPredicate } from '@/lib/region';

/**
 * Console-wide totals.
 *
 * Scoped to detections captured inside India, matching the evidence grid
 * below them. The two must use the same scope or the cards describe a
 * different population from the list they sit above.
 */
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
            FROM submissions s
            WHERE ${indiaGeoPredicate('s')}
        `),
            pool.query(`
            SELECT s.detection_type, COUNT(*)::int AS count
            FROM submissions s
            WHERE ${indiaGeoPredicate('s')}
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
