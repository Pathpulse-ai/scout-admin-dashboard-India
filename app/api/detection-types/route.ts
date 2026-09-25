import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { GEO_VERSION, indiaGeoPredicate } from '@/lib/region';
import { CLASS_SIZE_TTL_MS, cached } from '@/lib/queryCache';
import { REVIEW_COURT_READY } from '@/lib/submissions';

/**
 * Every detection class present in the data, with its review progress.
 *
 * `total` is the all-time size of the class and never falls as work is done,
 * which is why the remaining counts are returned alongside it: a reviewer
 * wants to know what is LEFT in a class, not how big it has ever been.
 *
 * Scoped to India-captured detections, matching the evidence grid and the stat
 * cards: a class filter counting a different population from the list it
 * filters would not agree with it.
 */
export async function GET() {
    try {
        const rows = await cached(`detection-types|${GEO_VERSION}`, CLASS_SIZE_TTL_MS, async () => {
            const result = await pool.query(`
            SELECT
                s.detection_type,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE s.verification_status = 'pending')::int  AS pending,
                COUNT(*) FILTER (WHERE s.verification_status = 'verified')::int AS verified,
                COUNT(*) FILTER (WHERE s.verification_status = 'rejected')::int AS rejected,
                COUNT(*) FILTER (
                  WHERE s.verification_status = 'verified'
                    AND EXISTS (
                      SELECT 1 FROM submission_image_reviews r
                      WHERE r.submission_id = s.id
                        AND r.review_status = '${REVIEW_COURT_READY}'
                    )
                )::int AS court_ready
            FROM submissions s
            WHERE ${indiaGeoPredicate('s')}
              AND s.detection_type IS NOT NULL
            GROUP BY s.detection_type
            ORDER BY total DESC
            `);
            return result.rows;
        });

        return NextResponse.json(rows);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
