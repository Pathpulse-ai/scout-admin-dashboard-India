import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    const { rows: submissions } = await pool.query(`
      SELECT 
        s.id,
        s.account_id,
        s.detection_type,
        s.beats_earned::float AS beats_earned,
        s.latitude,
        s.longitude,
        s.verification_status,
        s.captured_at,
        u.username,
        COALESCE(u.country_code, 'Unknown') AS country_code
      FROM submissions s
      LEFT JOIN users u ON u.id = s.account_id
    `);

    const countryMap: Record<
      string,
      {
        country: string;
        active_scouts: Set<string>;
        total_submissions: number;
        total_beats: number;
        detection_types: Record<string, number>;
        verified_count: number;
      }
    > = {};

    for (const sub of submissions) {
      const country = sub.country_code;
      
      if (!countryMap[country]) {
        countryMap[country] = {
          country,
          active_scouts: new Set(),
          total_submissions: 0,
          total_beats: 0,
          detection_types: {},
          verified_count: 0,
        };
      }

      countryMap[country].active_scouts.add(sub.account_id);
      countryMap[country].total_submissions += 1;
      countryMap[country].total_beats += sub.beats_earned || 0;

      const dType = sub.detection_type || 'unknown';
      countryMap[country].detection_types[dType] = (countryMap[country].detection_types[dType] || 0) + 1;

      if (sub.verification_status === 'verified') {
        countryMap[country].verified_count += 1;
      }
    }

    const countryAnalytics = Object.values(countryMap)
      .map((c) => ({
        country: c.country,
        total_scouts: c.active_scouts.size,
        total_submissions: c.total_submissions,
        total_beats: parseFloat(c.total_beats.toFixed(2)),
        verified_rate:
          c.total_submissions > 0
            ? parseFloat(((c.verified_count / c.total_submissions) * 100).toFixed(1))
            : 0,
        detection_types: c.detection_types,
      }))
      .sort((a, b) => b.total_submissions - a.total_submissions);

    return NextResponse.json({
      scope: 'global',
      total_submissions: submissions.length,
      countries_data: countryAnalytics,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    console.error('Failed to aggregate global scout analytics:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}