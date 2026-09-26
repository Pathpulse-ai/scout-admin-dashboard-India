import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { GEO_VERSION, indiaGeoPredicate } from '@/lib/region';
import { CLASS_SIZE_TTL_MS, cached } from '@/lib/queryCache';

/**
 * A couple of real scout videos to annotate, for trying the tool before any
 * video has been uploaded. Drawn from the lane_line class as requested.
 *
 * URLs are rewritten through /api/video-proxy so frames drawn from them are
 * not CORS-tainted; see that route.
 */
const SAMPLE_CLASS = 'lane_line';
const SAMPLE_COUNT = 2;

export async function GET() {
  try {
    const videos = await cached(`sample-videos|${GEO_VERSION}|${SAMPLE_CLASS}`, CLASS_SIZE_TTL_MS, async () => {
      const { rows } = await pool.query(
        `SELECT s.id,
                s.detection_type,
                s.captured_at,
                u.username,
                s.processing_metadata->'video_asset'->>'url'         AS url,
                (s.processing_metadata->'video_asset'->>'duration_ms')::int AS duration_ms,
                (s.processing_metadata->'video_asset'->>'size_bytes')::bigint AS size_bytes
         FROM submissions s
         LEFT JOIN users u ON u.id = s.account_id
         WHERE ${indiaGeoPredicate('s')}
           AND s.detection_type = $1
           AND jsonb_typeof(s.processing_metadata) = 'object'
           AND s.processing_metadata->'video_asset' ? 'url'
         ORDER BY s.captured_at DESC
         LIMIT $2`,
        [SAMPLE_CLASS, SAMPLE_COUNT]
      );

      return rows
        .filter((r) => typeof r.url === 'string' && r.url)
        .map((r, i) => ({
          id: `sample-${r.id}`,
          submission_id: r.id as string,
          name: `Lane line sample ${i + 1}`,
          detection_type: r.detection_type as string,
          username: (r.username as string) ?? null,
          captured_at: r.captured_at,
          duration_ms: r.duration_ms as number | null,
          size_bytes: Number(r.size_bytes) || null,
          url: `/api/video-proxy?url=${encodeURIComponent(r.url as string)}`,
        }));
    });

    return NextResponse.json({ videos });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
