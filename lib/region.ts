/**
 * This console serves the India region only.
 *
 * Two different questions get asked about "India", and they do not agree in the
 * shared core database:
 *
 *  - WHERE a detection was captured (submission latitude/longitude)
 *  - WHO captured it (the scout account's registered country)
 *
 * Roughly 39% of submissions from India-registered accounts carry Nigerian
 * coordinates, and a large share of detections physically on Indian roads come
 * from accounts registered elsewhere. Anything map-, state- or road-related is
 * therefore scoped by geography, and the scout directory stays scoped by the
 * account country.
 */
export const REGION_COUNTRY_CODE = 'IN';
export const REGION_NAME = 'India';

/**
 * Outer bounding box. This is only a cheap PREFILTER, never the answer on its
 * own: a rectangle around India also contains Lahore, Multan, Dhaka, Kathmandu
 * and Colombo. Around 60% of the rows inside it are not Indian.
 */
export const INDIA_BOUNDS = {
  minLat: 6.5,
  maxLat: 35.7,
  minLon: 68.1,
  maxLon: 97.4,
} as const;

/**
 * The India/Pakistan border longitude at a given latitude.
 *
 * The border is far from vertical: it sits near 68.8E at the Rann of Kutch and
 * near 74.7E by Jammu. A single straight line either leaks Lahore (74.34E) or
 * drops Amritsar (74.87E), which are only half a degree apart, so it is
 * approximated piecewise.
 */
function pakistanBorderLon(alias: string) {
  const lat = `${alias}.latitude`;
  return `CASE
      WHEN ${lat} < 26.0 THEN 68.80 + 0.65 * (${lat} - 24.0)
      WHEN ${lat} < 28.0 THEN 70.10 + 0.40 * (${lat} - 26.0)
      WHEN ${lat} < 30.0 THEN 70.90 + 1.35 * (${lat} - 28.0)
      WHEN ${lat} < 31.6 THEN 73.60 + 0.63 * (${lat} - 30.0)
      ELSE 74.70
    END`;
}

/**
 * Neighbouring territory that falls inside the bounding box.
 *
 * Bangladesh is three blocks rather than one rectangle: a single rectangle
 * either swallows Kolkata (22.57N, 88.36E) on its west side or Meghalaya and
 * Assam (around 25.5N, 90.4E) on its north.
 */
function neighbourPredicates(alias: string) {
  const lat = `${alias}.latitude`;
  const lon = `${alias}.longitude`;

  return [
    // Pakistan
    `(${lat} > 23.6 AND ${lon} < ${pakistanBorderLon(alias)})`,
    // Bangladesh: south-west, west, then centre and east
    `(${lat} BETWEEN 21.50 AND 23.50 AND ${lon} BETWEEN 88.90 AND 89.85)`,
    `(${lat} BETWEEN 23.50 AND 26.70 AND ${lon} BETWEEN 88.05 AND 89.85)`,
    `(${lat} BETWEEN 21.50 AND 25.35 AND ${lon} BETWEEN 89.85 AND 91.05)`,
    `(${lat} BETWEEN 20.70 AND 25.25 AND ${lon} BETWEEN 91.05 AND 92.70)`,
    // Nepal
    `(${lat} BETWEEN 26.30 AND 30.50 AND ${lon} BETWEEN 80.05 AND 88.20)`,
    // Bhutan
    `(${lat} BETWEEN 26.70 AND 28.35 AND ${lon} BETWEEN 88.75 AND 92.12)`,
    // Sri Lanka
    `(${lat} BETWEEN 5.90 AND 9.90 AND ${lon} BETWEEN 79.60 AND 81.95)`,
    // China and Tibet, north of the Himalayan watershed
    `(${lat} > 35.0 OR (${lat} > 30.6 AND ${lon} > 79.5 AND ${lon} < 88.2))`,
    // Myanmar
    `(${lon} > 94.8 AND ${lat} < 28.5)`,
  ];
}

/**
 * SQL predicate restricting a submissions alias to detections captured in India.
 *
 * Rows without coordinates cannot be placed, so BETWEEN excludes them.
 *
 * Verified against 100,274 rows inside the bounding box, using the scout's
 * registered country as an independent check: it removes all 37,769 Pakistani
 * rows and 19,468 of the Bangladeshi ones while keeping 40,231 of 40,257
 * Indian ones. The rows that still disagree sit in Meghalaya and Assam, which
 * really are Indian ground captured by Bangladesh-registered scouts.
 *
 * Known limitation: Tripura is a salient almost surrounded by Bangladesh, and
 * rectangles cannot separate it from Comilla a few kilometres away, so it falls
 * outside. No detections exist there today. PostGIS 3.4.6 is available on this
 * server but not installed; installing it and loading a real boundary polygon
 * is the fix if border districts ever matter.
 */
export function indiaGeoPredicate(alias = 's') {
  const outside = neighbourPredicates(alias)
    .map((p) => `      AND NOT ${p}`)
    .join('\n');

  return `${alias}.latitude BETWEEN ${INDIA_BOUNDS.minLat} AND ${INDIA_BOUNDS.maxLat}
      AND ${alias}.longitude BETWEEN ${INDIA_BOUNDS.minLon} AND ${INDIA_BOUNDS.maxLon}
${outside}`;
}

/** The same test in TypeScript, for values already loaded into the process. */
export function isInsideIndia(lat: number, lon: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;

  if (
    lat < INDIA_BOUNDS.minLat ||
    lat > INDIA_BOUNDS.maxLat ||
    lon < INDIA_BOUNDS.minLon ||
    lon > INDIA_BOUNDS.maxLon
  ) {
    return false;
  }

  const pakistanLon =
    lat < 26.0 ? 68.8 + 0.65 * (lat - 24.0)
      : lat < 28.0 ? 70.1 + 0.4 * (lat - 26.0)
        : lat < 30.0 ? 70.9 + 1.35 * (lat - 28.0)
          : lat < 31.6 ? 73.6 + 0.63 * (lat - 30.0)
            : 74.7;
  if (lat > 23.6 && lon < pakistanLon) return false;

  const within = (a: number, b: number, c: number, d: number) =>
    lat >= a && lat <= b && lon >= c && lon <= d;

  if (within(21.5, 23.5, 88.9, 89.85)) return false;    // Bangladesh, south-west
  if (within(23.5, 26.7, 88.05, 89.85)) return false;   // Bangladesh, west
  if (within(21.5, 25.35, 89.85, 91.05)) return false;  // Bangladesh, centre
  if (within(20.7, 25.25, 91.05, 92.7)) return false;   // Bangladesh, east
  if (within(26.3, 30.5, 80.05, 88.2)) return false;    // Nepal
  if (within(26.7, 28.35, 88.75, 92.12)) return false;  // Bhutan
  if (within(5.9, 9.9, 79.6, 81.95)) return false;      // Sri Lanka
  if (lat > 35.0 || (lat > 30.6 && lon > 79.5 && lon < 88.2)) return false;  // China, Tibet
  if (lon > 94.8 && lat < 28.5) return false;           // Myanmar

  return true;
}

/**
 * Short fingerprint of the current geography.
 *
 * Cached counts are only valid for the predicate that produced them, so this
 * goes in their cache keys: changing the boundaries above silently invalidates
 * every cached total instead of serving numbers from the old shape.
 */
export const GEO_VERSION = (() => {
  const source = indiaGeoPredicate('s');
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
})();
