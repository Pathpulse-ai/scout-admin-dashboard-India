import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { REGION_COUNTRY_CODE } from '@/lib/region';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '');

    let query: string;
    let params: unknown[];

    if (isUUID) {
      query = `
        SELECT 
          u.id, 
          u.country, 
          u.country_code, 
          COALESCE(u.is_banned, false) AS is_banned,
          u.ban_reason,
          u.created_at,
          u.updated_at,
          COALESCE(COUNT(s.id), 0)::int AS submission_count,
          COALESCE(SUM(s.beats_earned), 0)::float AS total_beats
        FROM users u
        LEFT JOIN submissions s ON s.account_id = u.id
        WHERE u.id = $1 AND u.country_code = $2
        GROUP BY u.id, u.country, u.country_code, u.is_banned, u.ban_reason, u.created_at, u.updated_at
      `;
      params = [id, REGION_COUNTRY_CODE];
    } else {
      query = `
        SELECT 
          u.id, 
          u.country, 
          u.country_code, 
          COALESCE(u.is_banned, false) AS is_banned,
          u.ban_reason,
          u.created_at,
          u.updated_at,
          COALESCE(COUNT(s.id), 0)::int AS submission_count,
          COALESCE(SUM(s.beats_earned), 0)::float AS total_beats
        FROM users u
        LEFT JOIN submissions s ON s.account_id = u.id
        WHERE (u.username ILIKE $1 OR u.email ILIKE $1) AND u.country_code = $2
        GROUP BY u.id, u.country, u.country_code, u.is_banned, u.ban_reason, u.created_at, u.updated_at
        LIMIT 1
      `;
      params = [id, REGION_COUNTRY_CODE];
    }

    const { rows } = await pool.query(query, params);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch recent submissions for this user
    const { rows: submissions } = await pool.query(
      `SELECT id, detection_type, verification_status, beats_earned, created_at
       FROM submissions
       WHERE account_id = $1
       ORDER BY created_at DESC
       LIMIT 5`,
      [rows[0].id]
    );

    return NextResponse.json({
      user: rows[0],
      recent_submissions: submissions,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
