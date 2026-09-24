import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { REGION_COUNTRY_CODE, indiaGeoPredicate } from '@/lib/region';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function toPositiveInt(raw: string | null, fallback: number, max?: number) {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return typeof max === 'number' ? Math.min(parsed, max) : parsed;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = (searchParams.get('q') || '').trim();
  const limit = Math.max(1, toPositiveInt(searchParams.get('limit'), DEFAULT_LIMIT, MAX_LIMIT));
  const offset = toPositiveInt(searchParams.get('offset'), 0);

  const SELECTED_COLUMNS = `
          u.id,
          u.country,
          u.country_code,
          COALESCE(u.is_banned, false) AS is_banned,
          u.created_at,
          COALESCE(COUNT(s.id), 0)::int AS submission_count,
          COALESCE(SUM(s.beats_earned), 0)::float AS total_beats`;

  const GROUP_BY = `u.id, u.country, u.country_code, u.is_banned, u.created_at`;

  // The directory lists India-registered scouts, but their counted work is
  // restricted to detections captured inside India.
  const REGION_JOIN = `LEFT JOIN submissions s
          ON s.account_id = u.id
         AND ${indiaGeoPredicate('s')}`;

  try {
    let pageQuery: string;
    let pageParams: unknown[];
    let countQuery: string;
    let countParams: unknown[];

    if (search) {
      const like = `%${search}%`;

      // u.id is the tiebreaker so paging stays stable when scores collide.
      pageQuery = `
        SELECT ${SELECTED_COLUMNS}
        FROM users u
        ${REGION_JOIN}
        WHERE u.country_code = $1
          AND (
                u.id::text ILIKE $2
             OR u.username ILIKE $2
             OR u.email ILIKE $2
          )
        GROUP BY ${GROUP_BY}
        ORDER BY
          CASE WHEN u.id::text = $3 THEN 1 WHEN u.username ILIKE $2 THEN 2 ELSE 3 END,
          submission_count DESC,
          u.id ASC
        LIMIT $4 OFFSET $5
      `;
      pageParams = [REGION_COUNTRY_CODE, like, search, limit, offset];

      countQuery = `
        SELECT COUNT(*)::int AS total
        FROM users u
        WHERE u.country_code = $1
          AND (
                u.id::text ILIKE $2
             OR u.username ILIKE $2
             OR u.email ILIKE $2
          )
      `;
      countParams = [REGION_COUNTRY_CODE, like];
    } else {
      pageQuery = `
        SELECT ${SELECTED_COLUMNS}
        FROM users u
        ${REGION_JOIN}
        WHERE u.country_code = $1
        GROUP BY ${GROUP_BY}
        ORDER BY submission_count DESC, u.created_at DESC, u.id ASC
        LIMIT $2 OFFSET $3
      `;
      pageParams = [REGION_COUNTRY_CODE, limit, offset];

      countQuery = `SELECT COUNT(*)::int AS total FROM users WHERE country_code = $1`;
      countParams = [REGION_COUNTRY_CODE];
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
