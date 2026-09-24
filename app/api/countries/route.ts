import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { REGION_COUNTRY_CODE, REGION_NAME, indiaGeoPredicate } from '@/lib/region';

export async function GET() {
    try {
        // Single-region console: the only bucket is India, counted via the scout account.
        const { rows } = await pool.query(`
            SELECT
                $1::text AS country_code,
                $2::text AS country_name,
                COUNT(*)::int AS count
            FROM submissions s
            WHERE ${indiaGeoPredicate('s')}
        `, [REGION_COUNTRY_CODE, REGION_NAME]);

        return NextResponse.json(rows);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
