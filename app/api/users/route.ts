import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function toPositiveInt(raw: string | null, fallback: number, max?: number) {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return typeof max === 'number' ? Math.min(parsed, max) : parsed;
}

/**
 * The directory is global: every registered scout is listed, whatever country
 * the account belongs to, and their counted work is every submission they made.
 *
 * Paging is done in a MATERIALIZED CTE first, so the per-scout aggregates and
 * the device lookups only ever run for the 25 rows actually on screen. Joining
 * `submissions` across all ~83k users up front takes ~8s; this keeps it ~100ms.
 */
const PAGE_COLUMNS = `
          p.id,
          p.username,
          p.country,
          p.country_code,
          p.is_banned,
          p.created_at,
          p.account_beats,
          COALESCE(agg.submission_count, 0)::int AS submission_count,
          COALESCE(agg.total_beats, 0)::float AS total_beats,
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

/** Per-scout aggregates + device telemetry, attached to an already-paged set. */
const PAGE_JOINS = `
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS submission_count,
                 SUM(s.beats_earned)::float AS total_beats
          FROM submissions s
          WHERE s.account_id = p.id
        ) agg ON true
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
                 (SELECT COUNT(*)::int FROM device_fingerprints d2 WHERE d2.user_id = p.id) AS device_count
          FROM device_fingerprints df
          WHERE df.user_id = p.id
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
          WHERE t.account_id = p.id
            AND t.device_model IS NOT NULL
          ORDER BY t.created_at DESC NULLS LAST
          LIMIT 1
        ) trip ON true`;

const PAGE_SELECT_LIST = `
          u.id,
          u.username,
          u.country,
          u.country_code,
          COALESCE(u.is_banned, false) AS is_banned,
          u.created_at,
          COALESCE(u.beats, 0)::float AS account_beats`;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = (searchParams.get('q') || '').trim();
  const limit = Math.max(1, toPositiveInt(searchParams.get('limit'), DEFAULT_LIMIT, MAX_LIMIT));
  const offset = toPositiveInt(searchParams.get('offset'), 0);

  try {
    let pageQuery: string;
    let pageParams: unknown[];
    let countQuery: string;
    let countParams: unknown[];

    if (search) {
      const like = `%${search}%`;

      // Exact id first, then username hits, then everything else. u.id is the
      // tiebreaker so paging stays stable when the ranks collide.
      pageQuery = `
        WITH page AS MATERIALIZED (
          SELECT ${PAGE_SELECT_LIST},
                 CASE
                   WHEN u.id::text = $2 THEN 1
                   WHEN u.username ILIKE $1 THEN 2
                   ELSE 3
                 END AS match_rank
          FROM users u
          WHERE u.id::text ILIKE $1
             OR u.username ILIKE $1
             OR u.email ILIKE $1
          ORDER BY match_rank ASC, u.created_at DESC NULLS LAST, u.id ASC
          LIMIT $3 OFFSET $4
        )
        SELECT ${PAGE_COLUMNS}
        FROM page p
        ${PAGE_JOINS}
        ORDER BY p.match_rank ASC, p.created_at DESC NULLS LAST, p.id ASC
      `;
      pageParams = [like, search, limit, offset];

      countQuery = `
        SELECT COUNT(*)::int AS total
        FROM users u
        WHERE u.id::text ILIKE $1
           OR u.username ILIKE $1
           OR u.email ILIKE $1
      `;
      countParams = [like];
    } else {
      pageQuery = `
        WITH page AS MATERIALIZED (
          SELECT ${PAGE_SELECT_LIST}
          FROM users u
          ORDER BY u.created_at DESC NULLS LAST, u.id ASC
          LIMIT $1 OFFSET $2
        )
        SELECT ${PAGE_COLUMNS}
        FROM page p
        ${PAGE_JOINS}
        ORDER BY p.created_at DESC NULLS LAST, p.id ASC
      `;
      pageParams = [limit, offset];

      countQuery = `SELECT COUNT(*)::int AS total FROM users`;
      countParams = [];
    }

    const [pageResult, countResult] = await Promise.all([
      pool.query(pageQuery, pageParams),
      pool.query(countQuery, countParams),
    ]);

    const total = countResult.rows[0]?.total ?? 0;

    return NextResponse.json({
      users: pageResult.rows,
      total,
      limit,
      offset,
      has_more: offset + pageResult.rows.length < total,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
