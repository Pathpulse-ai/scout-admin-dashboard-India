/**
 * The one description of "which detections, in which order".
 *
 * The grid and the full-screen review page must produce the SAME ordered set,
 * because the reviewer's next/previous keys step through it by absolute index.
 * Both build their query from here so the two can never drift.
 */

export const GRID_PAGE_SIZE = 9;
export const GRID_BATCH_PAGES = 5;
export const GRID_BATCH_SIZE = GRID_PAGE_SIZE * GRID_BATCH_PAGES;   // 45, under the API's limit of 100

/** Which batch a given zero-based page lives in, and where inside it. */
export function batchIndexFor(page: number): number {
    return Math.floor(Math.max(0, page) / GRID_BATCH_PAGES);
}

export function offsetWithinBatch(page: number): number {
    return (Math.max(0, page) % GRID_BATCH_PAGES) * GRID_PAGE_SIZE;
}

/**
 * Records fetched per review window; the API caps `limit` at 100.
 *
 * Ordering the filtered set costs seconds on this dataset whatever the limit,
 * so the window is as large as the API allows and the next one is prefetched
 * before the reviewer reaches it.
 */
export const REVIEW_WINDOW = 100;

/** Start fetching the adjacent window once the cursor is this close to an edge. */
export const REVIEW_EDGE_MARGIN = 20;

/** Cap on retained rows, so a long session does not grow without bound. */
export const REVIEW_MAX_RETAINED = 400;

/**
 * `court_ready` is not a verification_status. It is the subset of VERIFIED
 * cases whose primary frame was filed as COURT_READY, so those cases keep
 * appearing under `verified` as well.
 */
export type ReviewTab = 'all' | 'pending' | 'verified' | 'rejected' | 'court_ready' | 'by_class';
export type ReviewRange = 'all' | 'today' | 'week' | 'month';

export interface DetectionFilters {
    tab: ReviewTab;
    /** Raw detection_type value; '' means every class. */
    type: string;
    range: ReviewRange;
    /** Resolved date_from as YYYY-MM-DD; '' when range is 'all'. */
    from: string;
    /** Free-text scout search; maps to the API's `username` parameter. */
    q: string;
    /** Named 5,000-image slice of the class, e.g. 'B'. '' means the whole class. */
    batch: string;
}

export const EMPTY_FILTERS: DetectionFilters = {
    tab: 'all',
    type: '',
    range: 'all',
    from: '',
    q: '',
    batch: '',
};

const TABS: ReviewTab[] = ['all', 'pending', 'verified', 'rejected', 'court_ready', 'by_class'];

export const REVIEW_COURT_READY = 'COURT_READY';
const RANGES: ReviewRange[] = ['all', 'today', 'week', 'month'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function resolveDateFrom(range: ReviewRange): string {
    const days = range === 'today' ? 0 : range === 'week' ? 7 : range === 'month' ? 30 : null;
    if (days === null) return '';
    const from = new Date();
    from.setDate(from.getDate() - days);
    return from.toISOString().slice(0, 10);
}

/** Query string for /api/submissions. */
export function toApiParams(filters: DetectionFilters, limit: number, offset: number): URLSearchParams {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', String(Math.max(0, offset)));
    if (filters.type) params.set('detection_type', filters.type);
    if (filters.tab === 'court_ready') {
        params.set('verification_status', 'verified');
        params.set('review_status', REVIEW_COURT_READY);
    } else if (filters.tab !== 'all' && filters.tab !== 'by_class') {
        // 'by_class' is a progress view, not a status; it never filters rows.
        params.set('verification_status', filters.tab);
    }
    if (filters.q) params.set('username', filters.q);
    if (filters.from) params.set('date_from', filters.from);
    // Only meaningful alongside a class; the server ignores it otherwise.
    if (filters.type && filters.batch) params.set('batch', filters.batch);
    return params;
}

/** Query string for /detections/<id> — the full-screen review page. */
export function toReviewParams(filters: DetectionFilters, index: number, total: number): URLSearchParams {
    const params = new URLSearchParams();
    params.set('i', String(Math.max(0, index)));
    if (filters.tab !== 'all') params.set('tab', filters.tab);
    if (filters.type) params.set('type', filters.type);
    if (filters.range !== 'all') {
        params.set('range', filters.range);
        if (filters.from) params.set('from', filters.from);
    }
    if (filters.q) params.set('q', filters.q);
    if (filters.type && filters.batch) params.set('batch', filters.batch);
    if (total > 0) params.set('total', String(total));
    return params;
}

/** Query string for /detections — the grid, so Back lands where the reviewer left. */
export function toGridParams(filters: DetectionFilters, page: number): URLSearchParams {
    const params = new URLSearchParams();
    if (filters.tab !== 'all') params.set('tab', filters.tab);
    if (filters.type) params.set('type', filters.type);
    if (filters.range !== 'all') {
        params.set('range', filters.range);
        if (filters.from) params.set('from', filters.from);
    }
    if (filters.q) params.set('q', filters.q);
    if (filters.type && filters.batch) params.set('batch', filters.batch);
    if (page > 0) params.set('page', String(page));
    return params;
}

export function parseFilters(search: URLSearchParams): DetectionFilters {
    const rawTab = search.get('tab') as ReviewTab | null;
    const rawRange = search.get('range') as ReviewRange | null;

    // 'pending' is the default because the grid no longer offers an
    // "All cases" tab; falling back to 'all' would select a tab that is not
    // rendered, leaving nothing highlighted.
    const tab = rawTab && TABS.includes(rawTab) ? rawTab : 'pending';
    const range = rawRange && RANGES.includes(rawRange) ? rawRange : 'all';

    // An arbitrary `from` reaches Postgres as $n::date, where a malformed value
    // throws and surfaces as a 500 with an empty viewer.
    const rawFrom = search.get('from') ?? '';
    const from = range === 'all' ? '' : ISO_DATE.test(rawFrom) ? rawFrom : resolveDateFrom(range);

    return {
        tab,
        type: search.get('type') ?? '',
        range,
        from,
        q: (search.get('q') ?? '').trim(),
        batch: (search.get('batch') ?? '').trim().toUpperCase(),
    };
}

export function parseIndex(search: URLSearchParams): number | null {
    const raw = search.get('i');
    if (raw === null) return null;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
}

export function parseTotalHint(search: URLSearchParams): number {
    const n = Number.parseInt(search.get('total') ?? '', 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

export function parsePage(search: URLSearchParams): number {
    const n = Number.parseInt(search.get('page') ?? '', 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Whether a case still belongs in the open tab.
 *
 * Acting on a case can drop it out of the current filter, which shifts every
 * later row; the review page counts those to keep absolute indices honest.
 */
export function matchesTab(
    tab: ReviewTab,
    verificationStatus: string | null | undefined,
    reviewStatus: string | null | undefined
): boolean {
    if (tab === 'all' || tab === 'by_class') return true;
    if (tab === 'court_ready') {
        return verificationStatus === 'verified' && reviewStatus === REVIEW_COURT_READY;
    }
    return verificationStatus === tab;
}

/** Any change here invalidates a cached review sequence. */
export function filterSignature(filters: DetectionFilters): string {
    return `${filters.tab}|${filters.type}|${filters.from}|${filters.q}|${filters.batch}`;
}

/** Where a window of REVIEW_WINDOW rows should start to keep `index` centred. */
export function windowStartFor(index: number, total: number): number {
    if (total <= REVIEW_WINDOW) return 0;
    const half = Math.floor(REVIEW_WINDOW / 2);
    return Math.min(Math.max(index - half, 0), total - REVIEW_WINDOW);
}
