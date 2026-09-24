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

/** Generous bounding box covering mainland India plus island territories. */
export const INDIA_BOUNDS = {
  minLat: 6.5,
  maxLat: 35.7,
  minLon: 68.1,
  maxLon: 97.4,
} as const;

/**
 * SQL predicate restricting a submissions alias to Indian coordinates.
 * Rows without coordinates cannot be placed, so they are excluded.
 */
export function indiaGeoPredicate(alias = 's') {
  return `${alias}.latitude BETWEEN ${INDIA_BOUNDS.minLat} AND ${INDIA_BOUNDS.maxLat}
      AND ${alias}.longitude BETWEEN ${INDIA_BOUNDS.minLon} AND ${INDIA_BOUNDS.maxLon}`;
}

export function isInsideIndia(lat: number, lon: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  return (
    lat >= INDIA_BOUNDS.minLat &&
    lat <= INDIA_BOUNDS.maxLat &&
    lon >= INDIA_BOUNDS.minLon &&
    lon <= INDIA_BOUNDS.maxLon
  );
}
