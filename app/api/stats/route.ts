import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { GEO_VERSION, indiaGeoPredicate } from '@/lib/region';
import { COUNT_TTL_MS, cached } from '@/lib/queryCache';

/**
 * Console-wide totals.
 *
 * Scoped to detections captured inside India, matching the evidence grid
 * below them. The two must use the same scope or the cards describe a
 * different population from the list they sit above.
 */
export async function GET() {
    try {
        // Both aggregates touch every India row; they are recomputed at most
        // once per TTL rather than on every page load.
        const [totals, byType] = await Promise.all([
            cached(`stats:totals|${GEO_VERSION}`, COUNT_TTL_MS, async () => (await pool.query(`
            SELECT
                COUNT(*)::int AS total_submissions,
                COUNT(*) FILTER (WHERE s.verification_status = 'verified')::int AS verified,
                COUNT(*) FILTER (WHERE s.verification_status = 'rejected')::int AS rejected,
                COUNT(*) FILTER (WHERE s.verification_status = 'pending')::int AS pending,
                COALESCE(SUM(s.frame_count), 0)::int AS total_frames
            FROM submissions s
            WHERE ${indiaGeoPredicate('s')}
        `)).rows),
            cached(`stats:by-type|${GEO_VERSION}`, COUNT_TTL_MS, async () => (await pool.query(`
            SELECT s.detection_type, COUNT(*)::int AS count
            FROM submissions s
            WHERE ${indiaGeoPredicate('s')}
            GROUP BY s.detection_type
            ORDER BY count DESC
        `)).rows),
        ]);

        return NextResponse.json({
            ...totals[0],
            detection_types: byType,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
