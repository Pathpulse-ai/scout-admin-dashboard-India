import { NextResponse } from 'next/server';
import { pool, resolveIndianState } from '@/lib/db';
import { REGION_COUNTRY_CODE, indiaGeoPredicate } from '@/lib/region';

export async function GET() {
  try {
    // 1. Fetch Indian submissions with user and detection attributes
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
        u.username
      FROM submissions s
      LEFT JOIN users u ON u.id = s.account_id
      WHERE ${indiaGeoPredicate('s')}
    `);

    // 2. Aggregate metrics by Indian State
    const stateMap: Record<
      string,
      {
        state: string;
        active_scouts: Set<string>;
        total_submissions: number;
        total_beats: number;
        detection_types: Record<string, number>;
        verified_count: number;
      }
    > = {};

    for (const sub of submissions) {
      const state = resolveIndianState(parseFloat(sub.latitude), parseFloat(sub.longitude));
      if (!stateMap[state]) {
        stateMap[state] = {
          state,
          active_scouts: new Set(),
          total_submissions: 0,
          total_beats: 0,
          detection_types: {},
          verified_count: 0,
        };
      }

      stateMap[state].active_scouts.add(sub.account_id);
      stateMap[state].total_submissions += 1;
      stateMap[state].total_beats += sub.beats_earned || 0;

      const dType = sub.detection_type || 'unknown';
      stateMap[state].detection_types[dType] = (stateMap[state].detection_types[dType] || 0) + 1;

      if (sub.verification_status === 'verified') {
        stateMap[state].verified_count += 1;
      }
    }

    const stateAnalytics = Object.values(stateMap)
      .map((st) => ({
        state: st.state,
        total_scouts: st.active_scouts.size,
        total_submissions: st.total_submissions,
        total_beats: parseFloat(st.total_beats.toFixed(2)),
        verified_rate:
          st.total_submissions > 0
            ? parseFloat(((st.verified_count / st.total_submissions) * 100).toFixed(1))
            : 0,
        detection_types: st.detection_types,
      }))
      .sort((a, b) => b.total_submissions - a.total_submissions);

    return NextResponse.json({
      country: REGION_COUNTRY_CODE,
      total_india_submissions: submissions.length,
      states_data: stateAnalytics,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    console.error('Failed to aggregate India scout analytics:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
