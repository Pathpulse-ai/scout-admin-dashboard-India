import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { REGION_COUNTRY_CODE } from '@/lib/region';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'events';
  
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  try {
    if (type === 'events') {
      const { rows } = await pool.query(`
        SELECT 
          fe.id,
          fe.user_id,
          u.country_code,
          fe.trip_id,
          fe.event_type,
          fe.severity,
          fe.details,
          fe.created_at,
          fe.reviewed,
          fe.device_fingerprint
        FROM fraud_events fe
        JOIN users u ON u.id = fe.user_id
        WHERE u.country_code = $1
        ORDER BY fe.created_at DESC
        LIMIT $2
      `, [REGION_COUNTRY_CODE, limit]);
      return NextResponse.json(rows);
    }

    if (type === 'banned-users') {
      const { rows } = await pool.query(`
        SELECT 
          u.id,
          u.username,
          u.email,
          u.is_banned,
          u.ban_reason,
          u.updated_at as banned_at,
          COALESCE(SUM(s.beats_earned), 0)::float as total_beats
        FROM users u
        LEFT JOIN submissions s ON s.account_id = u.id AND s.verification_status = 'verified'
        WHERE u.is_banned = true
          AND u.country_code = $1
        GROUP BY u.id, u.username, u.email, u.is_banned, u.ban_reason, u.updated_at
        ORDER BY u.updated_at DESC
        LIMIT $2 OFFSET $3
      `, [REGION_COUNTRY_CODE, limit, offset]);
      return NextResponse.json({ users: rows, total: rows.length });
    }

    if (type === 'banned-devices') {
      const { rows } = await pool.query(`
        SELECT db.*
        FROM device_bans db
        JOIN users u ON u.id = db.last_known_user_id
        WHERE u.country_code = $1
        ORDER BY db.created_at DESC
        LIMIT $2 OFFSET $3
      `, [REGION_COUNTRY_CODE, limit, offset]);
      return NextResponse.json({ bans: rows, total: rows.length });
    }

    if (type === 'high-risk') {
      const { rows } = await pool.query(`
        SELECT 
          u.id,
          u.username,
          u.country_code,
          COUNT(fe.id)::int as risk_score,
          COUNT(fe.id) FILTER (WHERE fe.created_at > NOW() - INTERVAL '30 days')::int as alerts_30d,
          0 as failed_trips,
          MAX(fe.created_at) as last_activity
        FROM users u
        JOIN fraud_events fe ON fe.user_id = u.id
        WHERE u.country_code = $1
        GROUP BY u.id, u.username, u.country_code
        HAVING COUNT(fe.id) > 5
        ORDER BY risk_score DESC
        LIMIT $2 OFFSET $3
      `, [REGION_COUNTRY_CODE, limit, offset]);
      return NextResponse.json({ users: rows, total: rows.length });
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { action: string; targetId: string; reason: string };
    const { action, targetId, reason } = body;

    if (action === 'ban-user') {
      await pool.query(
        `UPDATE users
         SET is_banned = TRUE, ban_reason = $1, updated_at = NOW()
         WHERE id = $2 AND country_code = $3`,
        [reason, targetId, REGION_COUNTRY_CODE]
      );
      return NextResponse.json({ success: true, message: `User ${targetId} banned.` });
    }

    if (action === 'ban-device') {
      await pool.query(
        `INSERT INTO device_bans (device_fingerprint, reason, created_at) VALUES ($1, $2, NOW())`,
        [targetId, reason]
      );
      return NextResponse.json({
        success: true,
        message: `Device fingerprint ${targetId} blacklisted.`,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
