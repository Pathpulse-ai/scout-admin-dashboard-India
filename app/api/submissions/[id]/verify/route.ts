import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { indiaGeoPredicate } from '@/lib/region';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
    const { id } = await context.params;

    try {
        const body = await request.json() as { status: string; rejection_reason?: string };
        const { status, rejection_reason } = body;

        if (!status || !['verified', 'rejected', 'pending'].includes(status)) {
            return NextResponse.json(
                { error: 'Invalid status. Must be verified, rejected, or pending.' },
                { status: 400 }
            );
        }

        const { rows } = await pool.query(
            // The geo guard keeps this console from editing another region's records.
            `UPDATE submissions s
             SET verification_status = $1::text,
                 rejection_reason = $2::text,
                 verified_at = CASE WHEN $1::text = 'verified' THEN NOW() ELSE s.verified_at END
             WHERE s.id = $3::uuid
               AND ${indiaGeoPredicate('s')}
             RETURNING *`,
            [status, rejection_reason || null, id]
        );

        if (rows.length === 0) {
            return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
        }

        return NextResponse.json(rows[0]);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
