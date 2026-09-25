import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { indiaGeoPredicate } from '@/lib/region';

/**
 * Every detection class present in the data, with its counts.
 *
 * Scoped to India-captured detections, matching the evidence grid and the stat
 * cards: a class filter counting a different population from the list it
 * filters would not agree with it.
 */
export async function GET() {
    try {
        const { rows } = await pool.query(`
            SELECT
                s.detection_type,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE s.verification_status = 'pending')::int AS pending
            FROM submissions s
            WHERE ${indiaGeoPredicate('s')}
              AND s.detection_type IS NOT NULL
            GROUP BY s.detection_type
            ORDER BY total DESC
        `);

        return NextResponse.json(rows);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
