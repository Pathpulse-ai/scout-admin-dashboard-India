import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

type RouteContext = { params: Promise<{ id: string }> };

/** Telemetry shared by both lookup paths: newest fingerprint, trip as fallback. */
const DEVICE_JOINS = `
        LEFT JOIN LATERAL (
          SELECT df.device_model,
                 df.os_version,
                 df.app_version,
                 df.manufacturer,
                 df.brand,
                 df.screen_width,
                 df.screen_height,
                 df.fingerprint,
                 df.last_seen_at,
                 (SELECT COUNT(*)::int FROM device_fingerprints d2 WHERE d2.user_id = u.id) AS device_count
          FROM device_fingerprints df
          WHERE df.user_id = u.id
          ORDER BY df.last_seen_at DESC NULLS LAST
          LIMIT 1
        ) dev ON true
        LEFT JOIN LATERAL (
          SELECT t.device_model,
                 t.os_version,
                 t.app_version,
                 t.device_platform,
                 t.created_at AS last_trip_at
          FROM trips t
          WHERE t.account_id = u.id
            AND t.device_model IS NOT NULL
          ORDER BY t.created_at DESC NULLS LAST
          LIMIT 1
        ) trip ON true`;

const DEVICE_COLUMNS = `
          COALESCE(dev.device_model, trip.device_model) AS device_model,
          COALESCE(dev.os_version, trip.os_version) AS os_version,
          COALESCE(dev.app_version, trip.app_version) AS app_version,
          dev.manufacturer,
          dev.brand,
          dev.screen_width,
          dev.screen_height,
          dev.fingerprint AS device_fingerprint,
          trip.device_platform,
          COALESCE(dev.last_seen_at, trip.last_trip_at) AS device_last_seen_at,
          COALESCE(dev.device_count, 0)::int AS device_count`;

const USER_COLUMNS = `
          u.id,
          u.username,
          u.country,
          u.country_code,
          COALESCE(u.is_banned, false) AS is_banned,
          u.ban_reason,
          u.created_at,
          u.updated_at,
          COALESCE(u.beats, 0)::float AS account_beats,
          COALESCE(agg.submission_count, 0)::int AS submission_count,
          COALESCE(agg.total_beats, 0)::float AS total_beats`;

const AGG_JOIN = `
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS submission_count,
                 SUM(s.beats_earned)::float AS total_beats
          FROM submissions s
          WHERE s.account_id = u.id
        ) agg ON true`;

// Scout records are looked up globally; the console no longer filters by the
// account's registered country.
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '');

    const query = isUUID
      ? `
        SELECT ${USER_COLUMNS}, ${DEVICE_COLUMNS}
        FROM users u
        ${AGG_JOIN}
        ${DEVICE_JOINS}
        WHERE u.id = $1
      `
      : `
        SELECT ${USER_COLUMNS}, ${DEVICE_COLUMNS}
        FROM users u
        ${AGG_JOIN}
        ${DEVICE_JOINS}
        WHERE u.username ILIKE $1 OR u.email ILIKE $1
        LIMIT 1
      `;

    const { rows } = await pool.query(query, [id]);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Every device this scout has been seen on, newest first.
    const { rows: devices } = await pool.query(
      `SELECT device_model, os_version, app_version, manufacturer, brand,
              screen_width, screen_height, fingerprint, is_flagged, trip_count,
              first_seen_at, last_seen_at
       FROM device_fingerprints
       WHERE user_id = $1
       ORDER BY last_seen_at DESC NULLS LAST
       LIMIT 10`,
      [rows[0].id]
    );

    // Recent submissions for this user
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
      devices,
      recent_submissions: submissions,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
