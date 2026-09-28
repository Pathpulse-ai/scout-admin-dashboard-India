import { pool } from './db';
import { CLASS_SIZE_TTL_MS, cached } from './queryCache';
import { GEO_VERSION, indiaGeoPredicate } from './region';
import { BATCH_SIZE } from './detectionFilters';

/**
 * Large classes are split into fixed, named work packets.
 *
 * A batch is a SLICE OF THE CLASS, not of the outstanding work: batch B is
 * always images 5,001 to 10,000 of that class ordered newest first, whatever
 * anyone has reviewed since. That is what makes "you take batch C" mean
 * something tomorrow as well as today.
 *
 * Boundaries are keyset pairs rather than OFFSETs. Postgres can jump straight
 * to a (captured_at, id) pair through the index, whereas OFFSET 20000 makes it
 * walk and geo-test every skipped row: 22 seconds versus 13 milliseconds.
 */
export { BATCH_SIZE };

/** A class smaller than this is left whole; splitting it would be noise. */
export const MIN_ROWS_TO_BATCH = BATCH_SIZE;

/** Bump when the boundary format or bounding logic changes, to drop stale cache. */
const BATCH_FORMAT_VERSION = 'v3';

export interface DetectionBatch {
    /** 'A', 'B', ... 'Z', 'AA', and so on. */
    label: string;
    /** 1-based position of this batch's first row within the class. */
    startRank: number;
    size: number;
    /** Inclusive upper keyset bound: rows at or below this, newest first. */
    fromCapturedAt: string;
    fromId: string;
    /** Exclusive lower bound, or null for the final batch. */
    toCapturedAt: string | null;
    toId: string | null;
}

/** 0 -> A, 25 -> Z, 26 -> AA. */
export function batchLabel(index: number): string {
    let n = index;
    let label = '';
    do {
        label = String.fromCharCode(65 + (n % 26)) + label;
        n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return label;
}

/**
 * Batch boundaries for one detection class.
 *
 * Walking the class to find every 5,000th row costs around 23 seconds, so the
 * result is cached: it only changes when the class grows, and one extra row
 * shifts nothing that matters to a reviewer.
 */
export async function loadBatches(detectionType: string): Promise<DetectionBatch[]> {
    if (!detectionType) return [];

    return cached(`batches|${BATCH_FORMAT_VERSION}|${GEO_VERSION}|${BATCH_SIZE}|${detectionType}`, CLASS_SIZE_TTL_MS, async () => {
        const { rows } = await pool.query(
            // captured_at is `timestamp without time zone`. Formatting it in
            // SQL avoids a JavaScript Date round-trip, which would read it as
            // local time and write it back as UTC, shifting every boundary.
            `SELECT to_char(captured_at, 'YYYY-MM-DD HH24:MI:SS.US') AS captured_text, id, rn, total
             FROM (
               SELECT s.captured_at,
                      s.id,
                      row_number() OVER (ORDER BY s.captured_at DESC, s.id DESC) AS rn,
                      COUNT(*) OVER () AS total
               FROM submissions s
               WHERE ${indiaGeoPredicate('s')}
                 AND s.detection_type = $1
             ) t
             WHERE (rn - 1) % ${BATCH_SIZE} = 0
             ORDER BY rn`,
            [detectionType]
        );

        if (rows.length === 0) return [];

        const total = Number(rows[0].total);
        if (total <= MIN_ROWS_TO_BATCH) return [];

        return rows.map((row, i) => {
            const next = rows[i + 1];
            const startRank = Number(row.rn);
            return {
                label: batchLabel(i),
                startRank,
                size: next ? Number(next.rn) - startRank : total - startRank + 1,
                fromCapturedAt: row.captured_text as string,
                fromId: row.id as string,
                toCapturedAt: next ? (next.captured_text as string) : null,
                toId: next ? (next.id as string) : null,
            };
        });
    });
}

/** The named batch, or null when the label is unknown or the class is unsplit. */
export async function findBatch(
    detectionType: string | null,
    label: string | null
): Promise<DetectionBatch | null> {
    if (!detectionType || !label) return null;
    const batches = await loadBatches(detectionType);
    return batches.find((b) => b.label === label.toUpperCase()) ?? null;
}

/**
 * SQL restricting an alias to one batch, as a keyset range.
 *
 * The whole sequence is ordered `captured_at DESC, id DESC`, so it descends
 * lexicographically on the pair and a ROW COMPARISON says exactly "at or after
 * this position". That matters for speed, not just brevity: Postgres turns a
 * row comparison into an index range scan, while the equivalent spelled-out
 * `a < x OR (a = x AND b >= y)` defeats it and scans the entire class. On
 * with_helmet that difference measured 13 milliseconds against 251 seconds.
 *
 * The id tiebreaker is DESC for the same reason: with `id ASC` the pair is not
 * monotonic, and the row comparison would be silently wrong.
 *
 * Returns the fragment plus the parameters to append, numbered from `nextIndex`.
 */
export function batchPredicate(batch: DetectionBatch, alias: string, nextIndex: number) {
    const key = `(${alias}.captured_at, ${alias}.id)`;
    const params: string[] = [batch.fromCapturedAt, batch.fromId];

    // At or after this batch's first row.
    let sql = ` AND ${key} <= ($${nextIndex}::timestamp, $${nextIndex + 1}::uuid)`;

    if (batch.toCapturedAt && batch.toId) {
        // Strictly before the next batch's first row.
        params.push(batch.toCapturedAt, batch.toId);
        sql += ` AND ${key} > ($${nextIndex + 2}::timestamp, $${nextIndex + 3}::uuid)`;
    }
    return { sql, params };
}
