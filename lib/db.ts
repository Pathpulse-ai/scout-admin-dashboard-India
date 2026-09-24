import { Pool } from 'pg';
import { isInsideIndia } from './region';

const globalForPg = globalThis as unknown as {
  pool: Pool | undefined;
};

export const pool =
  globalForPg.pool ??
  new Pool({
    connectionString: process.env.CORE_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPg.pool = pool;
}

// Coordinate bounding boxes for Indian States (fast fallback if PostGIS / GIS shapefiles are not indexed)
export function resolveIndianState(lat: number, lon: number): string {
  if (isNaN(lat) || isNaN(lon)) return "Unknown";
  // Guard first: without this, foreign coordinates fell through to "Other (India)".
  if (!isInsideIndia(lat, lon)) return "Outside India";
  if (lat >= 15.6 && lat <= 22.0 && lon >= 72.6 && lon <= 80.9) return "Maharashtra";
  if (lat >= 11.5 && lat <= 18.5 && lon >= 74.0 && lon <= 78.6) return "Karnataka";
  if (lat >= 28.4 && lat <= 28.9 && lon >= 76.8 && lon <= 77.3) return "Delhi NCR";
  if (lat >= 8.2 && lat <= 12.8 && lon >= 74.8 && lon <= 77.5) return "Kerala";
  if (lat >= 8.0 && lat <= 13.5 && lon >= 76.2 && lon <= 80.3) return "Tamil Nadu";
  if (lat >= 20.1 && lat <= 24.7 && lon >= 68.1 && lon <= 74.5) return "Gujarat";
  if (lat >= 23.8 && lat <= 30.2 && lon >= 69.5 && lon <= 78.3) return "Rajasthan";
  if (lat >= 23.8 && lat <= 30.4 && lon >= 77.1 && lon <= 84.6) return "Uttar Pradesh";
  if (lat >= 21.5 && lat <= 27.2 && lon >= 85.8 && lon <= 89.9) return "West Bengal";
  if (lat >= 15.8 && lat <= 19.9 && lon >= 77.2 && lon <= 81.8) return "Telangana";
  return "Other (India)";
}

/** processing_metadata arrives as jsonb (object) or, on older rows, as a JSON string. */
export function parseJSONMetadata(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === 'object') return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** Video submissions carry their playable asset inside processing_metadata. */
export function extractVideoAsset(metadata: unknown): { url: string } | null {
  const parsed = parseJSONMetadata(metadata);
  if (!parsed) return null;

  const videoAsset = parsed.video_asset;
  if (!videoAsset) return null;

  if (typeof videoAsset === 'string' && videoAsset.trim() !== '') {
    return { url: videoAsset };
  }

  if (typeof videoAsset === 'object') {
    const asset = videoAsset as { url?: unknown };
    if (typeof asset.url === 'string' && asset.url.trim() !== '') {
      return videoAsset as { url: string };
    }
  }

  return null;
}
