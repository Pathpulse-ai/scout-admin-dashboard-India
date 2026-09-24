import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { REGION_COUNTRY_CODE } from '@/lib/region';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'beats'; // 'beats' | 'referral'
  const view = searchParams.get('view') || 'current'; // 'current' | 'lastEnded'

  try {
    // 1. Last Ended History View
    if (view === 'lastEnded') {
      const historyTable = type === 'beats' ? 'beats_leaderboard_history' : 'referral_leaderboard_history';

      try {
        const { rows } = await pool.query(`
          SELECT 
            h.rank, 
            h.user_id AS "userId", 
            COALESCE(u.username, h.username) AS username, 
            COALESCE(u.photo_url, h.photo_url) AS "avatarUrl",
            ${type === 'beats' ? 'ROUND(COALESCE(h.beats, 0)::numeric, 1)::float AS beats' : '0::float AS beats'},
            ${type === 'beats' ? '0::int AS "referralPoints"' : 'COALESCE(h.referral_points, 0)::int AS "referralPoints"'},
            ${type === 'beats' ? '0::int AS "normalReferrals"' : 'COALESCE(h.normal_referrals, 0)::int AS "normalReferrals"'},
            ${type === 'beats' ? '0::int AS "successfulReferrals"' : 'COALESCE(h.successful_referrals, 0)::int AS "successfulReferrals"'}
          FROM ${historyTable} h
          JOIN users u ON u.id = h.user_id
          WHERE h.reset_date = (SELECT MAX(reset_date) FROM ${historyTable})
            AND u.country_code = $1
          ORDER BY h.rank ASC
          LIMIT 100
        `, [REGION_COUNTRY_CODE]);
        if (rows.length > 0) return NextResponse.json(rows);
      } catch {
        // Fallback to leaderboard_events if history table is absent
        try {
          const { rows } = await pool.query(
            `
            SELECT 
              rank, 
              user_id AS "userId", 
              username, 
              COALESCE(beats, 0)::float AS beats, 
              COALESCE(referral_points, 0)::int AS "referralPoints"
            FROM leaderboard_events
            WHERE event_type = $1
              AND user_id IN (SELECT id FROM users WHERE country_code = $2)
            ORDER BY rank ASC
            LIMIT 100
          `,
            [type, REGION_COUNTRY_CODE]
          );
          return NextResponse.json(rows);
        } catch {
          return NextResponse.json([]);
        }
      }
      return NextResponse.json([]);
    }

    // 2. Current Beats Leaderboard
    if (type === 'beats') {
      // Primary: query dedicated beats_leaderboards table (cloned from scout-admin-dashboard-main)
      try {
        const { rows } = await pool.query(`
          SELECT 
            ROW_NUMBER() OVER (ORDER BY bl.beats DESC, bl.user_id ASC) AS rank,
            bl.user_id AS "userId",
            COALESCE(u.username, bl.username) AS username,
            COALESCE(u.photo_url, bl.photo_url) AS "avatarUrl",
            ROUND(bl.beats::numeric, 1)::float AS beats
          FROM beats_leaderboards bl
          JOIN users u ON u.id = bl.user_id
          WHERE bl.beats > 0
            AND u.country_code = $1
          ORDER BY bl.beats DESC, bl.user_id ASC
          LIMIT 100
        `, [REGION_COUNTRY_CODE]);
        if (rows.length > 0) {
          return NextResponse.json(rows);
        }
      } catch {
        // Fall through to aggregate from submissions if table not populated/absent
      }

      // Fallback: Aggregate directly from verified submissions
      const { rows } = await pool.query(`
        SELECT 
          ROW_NUMBER() OVER (ORDER BY SUM(s.beats_earned) DESC) AS rank,
          s.account_id AS "userId",
          u.username,
          u.photo_url AS "avatarUrl",
          ROUND(SUM(s.beats_earned)::numeric, 1)::float AS beats
        FROM submissions s
        JOIN users u ON u.id = s.account_id
        WHERE s.verification_status = 'verified'
          AND u.country_code = $1
        GROUP BY s.account_id, u.username, u.photo_url
        ORDER BY beats DESC
        LIMIT 100
      `, [REGION_COUNTRY_CODE]);
      return NextResponse.json(rows);
    } 

    // 3. Current Referral Leaderboard
    // Primary: query dedicated referral_leaderboards table (cloned from scout-admin-dashboard-main)
    try {
      const { rows } = await pool.query(`
        SELECT 
          ROW_NUMBER() OVER (ORDER BY rl.referral_points DESC, rl.user_id ASC) AS rank,
          rl.user_id AS "userId",
          COALESCE(u.username, rl.username) AS username,
          COALESCE(u.photo_url, rl.photo_url) AS "avatarUrl",
          0::float AS beats,
          COALESCE(rl.referral_points, 0)::int AS "referralPoints",
          COALESCE(rl.normal_referrals, 0)::int AS "normalReferrals",
          COALESCE(rl.successful_referrals, 0)::int AS "successfulReferrals"
        FROM referral_leaderboards rl
        JOIN users u ON u.id = rl.user_id
        WHERE rl.referral_points > 0
          AND u.country_code = $1
        ORDER BY rl.referral_points DESC, rl.user_id ASC
        LIMIT 100
      `, [REGION_COUNTRY_CODE]);
      if (rows.length > 0) {
        return NextResponse.json(rows);
      }
    } catch {
      // Fall through to query users table
    }

    // Fallback: Query users table
    const { rows } = await pool.query(`
      SELECT 
        ROW_NUMBER() OVER (ORDER BY u.referral_points DESC) AS rank,
        u.id AS "userId",
        u.username,
        u.photo_url AS "avatarUrl",
        0::float AS beats,
        COALESCE(u.referral_points, 0)::int AS "referralPoints",
        COALESCE(u.normal_referrals, 0)::int AS "normalReferrals",
        COALESCE(u.successful_referrals, 0)::int AS "successfulReferrals"
      FROM users u
      WHERE u.country_code = $1
      ORDER BY u.referral_points DESC
      LIMIT 100
    `, [REGION_COUNTRY_CODE]);
    return NextResponse.json(rows);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
