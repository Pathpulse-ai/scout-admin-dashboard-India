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

        // Per-class captures from Video annotation, counted live and merged in.
        // A class that only exists as captures (no scout submissions yet) is
        // still listed, so its captures are not invisible.
        const { rows: captureRows } = await pool.query(
            `SELECT a.detection_type,
                    COUNT(*)::int AS captures,
                    COUNT(*) FILTER (WHERE r.review_status = '${REVIEW_COURT_READY}')::int AS captures_court_ready
             FROM video_annotations a
             LEFT JOIN submission_image_reviews r ON r.annotation_id = a.id
             GROUP BY a.detection_type`
        );
        const captureBy: Record<string, { captures: number; court: number }> = {};
        for (const r of captureRows) {
            captureBy[r.detection_type as string] = {
                captures: r.captures as number,
                court: r.captures_court_ready as number,
            };
        }

        type ClassRow = {
            detection_type: string;
            total: number;
            pending: number;
            verified: number;
            rejected: number;
            court_ready: number;
            captures: number;
            captures_court_ready: number;
        };
        const merged: ClassRow[] = (rows as Array<Omit<ClassRow, 'captures' | 'captures_court_ready'>>).map((r) => ({
            ...r,
            captures: captureBy[r.detection_type]?.captures ?? 0,
            captures_court_ready: captureBy[r.detection_type]?.court ?? 0,
        }));
        for (const [type, counts] of Object.entries(captureBy)) {
            if (!merged.some((r) => r.detection_type === type)) {
                merged.push({
                    detection_type: type,
                    total: 0,
                    pending: 0,
                    verified: 0,
                    rejected: 0,
                    court_ready: 0,
                    captures: counts.captures,
                    captures_court_ready: counts.court,
                });
            }
        }

        return NextResponse.json(merged);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
