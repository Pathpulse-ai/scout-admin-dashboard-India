import { NextRequest, NextResponse } from 'next/server';
import { BATCH_SIZE, loadBatches } from '@/lib/detectionBatches';

/**
 * Fixed work packets for one detection class.
 *
 * Empty when the class is small enough to review whole.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const detectionType = searchParams.get('detection_type');

  if (!detectionType) {
    return NextResponse.json({ batch_size: BATCH_SIZE, batches: [] });
  }

  try {
    const batches = await loadBatches(detectionType);
    return NextResponse.json({
      detection_type: detectionType,
      batch_size: BATCH_SIZE,
      batches: batches.map((b) => ({
        label: b.label,
        start_rank: b.startRank,
        size: b.size,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
