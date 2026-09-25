/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    ArrowLeft,
    ArrowRight,
    Check,
    Film,
    ImageOff,
    Keyboard,
    Loader2,
    MapPin,
    TriangleAlert,
    User,
    X,
} from "lucide-react";
import { Submission, VerificationStatus } from "@/types";
import CourtReadyDialog from "@/components/detections/CourtReadyDialog";
import { cn } from "@/lib/utils";
import {
    DetectionFilters,
    GRID_PAGE_SIZE,
    REVIEW_EDGE_MARGIN,
    REVIEW_MAX_RETAINED,
    REVIEW_WINDOW,
    filterSignature,
    matchesTab,
    parseFilters,
    parseIndex,
    parseTotalHint,
    toApiParams,
    toGridParams,
    toReviewParams,
    windowStartFor,
} from "@/lib/detectionFilters";

const detectionTypeLabels: Record<string, string> = {
    with_helmet: "With Helmet",
    without_helmet: "Without Helmet",
    DHelmet: "Helmet (Detector)",
    DNoHelmet: "No Helmet (Detector)",
    "rider-with-helmet": "Rider With Helmet",
    "rider-with-nohelmet": "Rider Without Helmet",
    license_plate: "Licence Plate",
    lane_weave: "Lane Weaving",
    ego_lane_change: "Lane Change",
    rashdriving_lane_weave: "Rash Driving / Weaving",
    wrong_way: "Wrong Way",
    sudden_accel: "Sudden Acceleration",
    sharp_turn: "Sharp Turn",
};

function formatDetectionTypeLabel(type?: string | null) {
    if (!type) return "Traffic Violation";
    if (detectionTypeLabels[type]) return detectionTypeLabels[type];
    return type
        .replace(/[_-]+/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Never substitute a plausible value: an officer reads this as evidence. */
function Field({ label, value }: { label: string; value: React.ReactNode }) {
    const empty =
        value === null || value === undefined || value === "" || Number.isNaN(value as number);
    return (
        <div className="min-w-0">
            <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">{label}</p>
            {empty ? (
                <p className="text-xs font-semibold text-[#CBD5E1] mt-0.5">Not recorded</p>
            ) : (
                <p className="text-xs font-bold text-[#0F172A] mt-0.5 break-words">{value}</p>
            )}
        </div>
    );
}

function StatusPill({ status }: { status: VerificationStatus | string }) {
    if (status === "verified") {
        return (
            <span className="bg-[#D1FAE5] text-[#065F46] border border-[#A7F3D0] text-[11px] font-bold px-3 py-1 rounded-full">
                Validated
            </span>
        );
    }
    if (status === "rejected") {
        return (
            <span className="bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA] text-[11px] font-bold px-3 py-1 rounded-full">
                Dismissed
            </span>
        );
    }
    return (
        <span className="bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] text-[11px] font-bold px-3 py-1 rounded-full">
            Pending review
        </span>
    );
}

function formatDateTime(value?: string | null) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
}

export default function ReviewClient() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Depend on primitives, never on the ReadonlyURLSearchParams object, which
    // is rebuilt on unrelated router activity.
    const search = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);
    const filters: DetectionFilters = useMemo(() => parseFilters(search), [search]);
    const signature = filterSignature(filters);
    const urlIndex = useMemo(() => parseIndex(search), [search]);
    const totalHint = useMemo(() => parseTotalHint(search), [search]);
    const urlCaseId = search.get("id") ?? "";

    /** A deep link with no index has no sequence to walk; show the one case. */
    const isStandalone = urlIndex === null;

    const [index, setIndex] = useState(urlIndex ?? 0);
    const [items, setItems] = useState<Submission[]>([]);
    const [windowStart, setWindowStart] = useState(() => (urlIndex === null ? 0 : urlIndex));
    const [total, setTotal] = useState(totalHint);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [isActing, setIsActing] = useState(false);

    /** Set while the court-ready question is on screen. */
    const [courtPromptFor, setCourtPromptFor] = useState<string | null>(null);

    /**
     * Absolute indices whose record left the server-side filter after a
     * decision (validating under the Pending tab, for example). Later windows
     * must shift by this many rows or the reviewer silently skips cases.
     */
    const removedRef = useRef<Set<number>>(new Set());

    // A state gate would be batched, so two keydowns in one task both pass it.
    const actingRef = useRef(false);
    const abortRef = useRef<AbortController | null>(null);

    const gridHref = `/detections?${toGridParams(
        filters,
        Math.floor(Math.max(0, index) / GRID_PAGE_SIZE)
    ).toString()}`;

    const current = isStandalone ? items[0] : items[index - windowStart];
    const atFirst = index <= 0;
    const atLast = total > 0 && index >= total - 1;

    // A filter change invalidates the whole sequence, including what was removed.
    useEffect(() => {
        removedRef.current = new Set();
    }, [signature]);

    const removedBefore = useCallback((start: number) => {
        let n = 0;
        removedRef.current.forEach((i) => {
            if (i < start) n += 1;
        });
        return n;
    }, []);

    // Load the window that covers `index`, or the single record for a deep link.
    const needsWindow = !isStandalone && (index < windowStart || index >= windowStart + items.length);
    const hasLoadedRef = useRef(false);

    useEffect(() => {
        if (!isStandalone && !needsWindow && hasLoadedRef.current) return;

        const controller = new AbortController();
        let cancelled = false;

        (async () => {
            setIsLoading(true);
            setLoadError(null);
            try {
                if (isStandalone) {
                    const res = await fetch(`/api/submissions/${urlCaseId}`, {
                        cache: "no-store",
                        signal: controller.signal,
                    });
                    if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
                    const data = (await res.json()) as { submission: Submission };
                    if (cancelled) return;
                    setItems(data.submission ? [data.submission] : []);
                    setWindowStart(0);
                    setIndex(0);
                    setTotal(1);
                } else {
                    const knownTotal = total > 0 ? total : index + REVIEW_WINDOW;
                    const targetStart = windowStartFor(index, knownTotal);
                    const offset = Math.max(0, targetStart - removedBefore(targetStart));

                    const query = toApiParams(filters, REVIEW_WINDOW, offset);
                    // The grid already paid for the count; re-running it per
                    // window would stall every boundary crossing by seconds.
                    if (total > 0) query.set("count", "skip");

                    const res = await fetch(`/api/submissions?${query.toString()}`, {
                        cache: "no-store",
                        signal: controller.signal,
                    });
                    if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
                    const data = (await res.json()) as {
                        submissions: Submission[];
                        total: number | null;
                    };
                    if (cancelled) return;

                    const snapshotTotal =
                        data.total === null ? total : data.total + removedRef.current.size;
                    setItems(data.submissions ?? []);
                    setWindowStart(targetStart);
                    setTotal(snapshotTotal);
                    if (snapshotTotal > 0 && index > snapshotTotal - 1) {
                        setIndex(snapshotTotal - 1);
                    }
                }
                hasLoadedRef.current = true;
            } catch (err) {
                if ((err as Error)?.name === "AbortError" || cancelled) return;
                setItems([]);
                setLoadError("Unable to load this case. Check the connection and retry.");
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
            controller.abort();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [signature, index, needsWindow, isStandalone, urlCaseId]);

    // Cancel only on unmount. Aborting mid-flight would not undo a committed UPDATE.
    useEffect(() => () => abortRef.current?.abort(), []);

    /**
     * Pull the adjacent window in the background before the cursor reaches it.
     * Ordering this dataset costs seconds, so an on-demand fetch at the edge
     * would stall the reviewer mid-queue.
     */
    const prefetchingRef = useRef<Set<number>>(new Set());

    useEffect(() => {
        if (isStandalone || isLoading || items.length === 0) return;

        const loadedEnd = windowStart + items.length;
        const nearEnd = index >= loadedEnd - REVIEW_EDGE_MARGIN;
        const nearStart = index <= windowStart + REVIEW_EDGE_MARGIN;

        const forward = nearEnd && (total <= 0 || loadedEnd < total);
        const backward = nearStart && windowStart > 0;
        if (!forward && !backward) return;

        const targetStart = forward ? loadedEnd : Math.max(0, windowStart - REVIEW_WINDOW);
        if (prefetchingRef.current.has(targetStart)) return;
        prefetchingRef.current.add(targetStart);

        const controller = new AbortController();
        let cancelled = false;

        (async () => {
            try {
                const span = forward ? REVIEW_WINDOW : windowStart - targetStart;
                const query = toApiParams(
                    filters,
                    span,
                    Math.max(0, targetStart - removedBefore(targetStart))
                );
                if (total > 0) query.set("count", "skip");

                const res = await fetch(`/api/submissions?${query.toString()}`, {
                    cache: "no-store",
                    signal: controller.signal,
                });
                if (!res.ok) return;
                const data = (await res.json()) as { submissions: Submission[] };
                if (cancelled || !data.submissions?.length) return;

                // Merge outside the updater so the matching windowStart is
                // computed from the same snapshot.
                const merged = forward
                    ? [...items, ...data.submissions]
                    : [...data.submissions, ...items];
                let nextStart = forward ? windowStart : targetStart;
                let nextItems = merged;

                if (merged.length > REVIEW_MAX_RETAINED) {
                    if (forward) {
                        // Trim the oldest rows and slide the start to match.
                        const drop = merged.length - REVIEW_MAX_RETAINED;
                        nextItems = merged.slice(drop);
                        nextStart = windowStart + drop;
                    } else {
                        nextItems = merged.slice(0, REVIEW_MAX_RETAINED);
                    }
                }

                // Never trim the row the reviewer is looking at.
                if (index >= nextStart && index < nextStart + nextItems.length) {
                    setItems(nextItems);
                    setWindowStart(nextStart);
                }
            } catch {
                // A failed prefetch is silent; the blocking fetch will retry.
            } finally {
                prefetchingRef.current.delete(targetStart);
            }
        })();

        return () => {
            cancelled = true;
            controller.abort();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [index, windowStart, items, total, isLoading, isStandalone, signature]);

    /** Keep the URL honest without stacking one history entry per keypress. */
    const syncUrl = useCallback(
        (nextIndex: number, nextId: string) => {
            const params = toReviewParams(filters, nextIndex, total);
            params.set("id", nextId);
            // Query-only replace: same mount, so the loaded window survives.
            router.replace(`/detections/review?${params.toString()}`, { scroll: false });
        },
        [filters, total, router]
    );

    const goBy = useCallback(
        (delta: number) => {
            if (isStandalone) return;
            setActionError(null);
            setIndex((prev) => {
                const next = prev + delta;
                if (next < 0) return prev;
                if (total > 0 && next > total - 1) return prev;
                return next;
            });
        },
        [isStandalone, total]
    );

    const runAction = useCallback(
        async (
            nextStatus: Exclude<VerificationStatus, "pending">,
            courtReady?: boolean
        ) => {
            const target = isStandalone ? items[0] : items[index - windowStart];
            if (!target || actingRef.current) return;

            actingRef.current = true;
            setIsActing(true);
            setActionError(null);

            const targetId = target.id;
            const targetIndex = index;
            const previousStatus = target.verification_status;
            const previousReview = target.review_status ?? null;
            const controller = new AbortController();
            abortRef.current = controller;

            try {
                const res = await fetch(`/api/submissions/${targetId}/verify`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        status: nextStatus,
                        rejection_reason: nextStatus === "rejected" ? "Dismissed by officer" : undefined,
                        court_ready: courtReady,
                    }),
                    signal: controller.signal,
                });

                // fetch resolves on 4xx/5xx, so an unchecked response would report
                // success while nothing was written.
                if (!res.ok) {
                    const detail = (await res.json().catch(() => null)) as { error?: string } | null;
                    throw new Error(detail?.error ?? `Update failed (HTTP ${res.status})`);
                }

                const saved = (await res.json()) as {
                    verification_status: VerificationStatus;
                    rejection_reason: string | null;
                    verified_at: string | null;
                    court_ready: boolean | null;
                    review_status: string | null;
                };

                // Merge only the mutable fields by name. Spreading the response
                // would wipe the joined username and the assembled media.
                setItems((prev) =>
                    prev.map((s) =>
                        s.id === targetId
                            ? {
                                  ...s,
                                  verification_status: saved.verification_status,
                                  rejection_reason: saved.rejection_reason,
                                  verified_at: saved.verified_at,
                                  court_ready: saved.court_ready,
                                  review_status: saved.review_status,
                              }
                            : s
                    )
                );

                // The decision may have dropped this record out of the open
                // tab, which shifts every later row in the server's result set.
                const wasInTab = matchesTab(filters.tab, previousStatus, previousReview);
                const stillInTab = matchesTab(
                    filters.tab,
                    saved.verification_status,
                    saved.review_status
                );
                if (!isStandalone && wasInTab && !stillInTab) {
                    removedRef.current.add(targetIndex);
                }

                if (!isStandalone) goBy(1);
            } catch (err) {
                if ((err as Error)?.name === "AbortError") return;
                setActionError((err as Error)?.message ?? "Could not save this decision.");
            } finally {
                actingRef.current = false;
                setIsActing(false);
            }
        },
        [items, index, windowStart, isStandalone, filters.tab, goBy]
    );

    /** Validate always asks the court-ready question first. */
    const askCourtReady = useCallback(() => {
        const target = isStandalone ? items[0] : items[index - windowStart];
        if (!target || actingRef.current) return;
        setActionError(null);
        setCourtPromptFor(target.id);
    }, [items, index, windowStart, isStandalone]);

    const answerCourtReady = useCallback(
        async (courtReady: boolean) => {
            await runAction("verified", courtReady);
            setCourtPromptFor(null);
        },
        [runAction]
    );

    // Latest-ref indirection: a handler registered once would otherwise close
    // over the index and items from first render forever.
    const handlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
    useEffect(() => {
        handlerRef.current = (e: KeyboardEvent) => {
            if (courtPromptFor !== null) return;
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            if (e.repeat) return;

            const el = e.target as HTMLElement | null;
            if (
                el &&
                (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
            ) {
                return;
            }

            const isPrev = e.key === "ArrowLeft";
            const isNext = e.key === "ArrowRight";
            const isValidate = e.key === "1" || e.code === "Numpad1";
            const isDismiss = e.key === "2" || e.code === "Numpad2";

            // Only the four bound keys are cancelled, so Space still plays the
            // focused clip and the other arrows still scroll.
            if (!isPrev && !isNext && !isValidate && !isDismiss) return;
            e.preventDefault();
            e.stopPropagation();

            if (isPrev) goBy(-1);
            else if (isNext) goBy(1);
            else if (isValidate) askCourtReady();
            else void runAction("rejected");
        };
    });

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => handlerRef.current(e);
        // Capture beats the focused <video>, which would otherwise seek on arrows.
        window.addEventListener("keydown", onKeyDown, { capture: true });
        return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
    }, []);

    // Mirror the cursor into the URL once the record for it is known.
    useEffect(() => {
        if (isStandalone || !current) return;
        if (current.id === urlCaseId && parseIndex(search) === index) return;
        syncUrl(index, current.id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [index, current?.id, isStandalone]);

    const videoUrl = current?.video_asset?.url;
    const primaryImage =
        current?.images?.find((img) => img.is_primary) ?? current?.images?.[0];
    const imageUrl = primaryImage?.image_url;

    const position = total > 0 ? `${Math.min(index + 1, total)} of ${total.toLocaleString()}` : null;

    return (
        <div className="max-w-6xl mx-auto pb-16 font-sans space-y-5">
            {/* Header: back out, position in the queue, live status */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-3 min-w-0">
                    <button
                        onClick={() => router.push(gridHref)}
                        className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-[#E2E8F0] bg-white text-xs font-bold text-[#475569] hover:border-[#00DF89] hover:text-[#0F172A] transition-colors cursor-pointer shrink-0"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to grid</span>
                    </button>
                    <div className="min-w-0">
                        <h1 className="text-xl font-extrabold text-[#0F172A] tracking-tight truncate">
                            {formatDetectionTypeLabel(current?.detection_type)}
                        </h1>
                        <p className="text-[11px] font-semibold text-[#64748B] font-mono truncate">
                            {current?.id ?? urlCaseId}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    {position && (
                        <span className="text-xs font-bold text-[#64748B] font-mono">{position}</span>
                    )}
                    {current && <StatusPill status={current.verification_status} />}
                </div>
            </div>

            {/* Shortcut legend */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 bg-white rounded-2xl border border-[#E2E8F0] px-4 py-2.5 shadow-sm">
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#64748B]">
                    <Keyboard className="w-3.5 h-3.5 text-[#94A3B8]" />
                    Shortcuts
                </span>
                {[
                    { keys: "←", label: "Previous" },
                    { keys: "→", label: "Next" },
                    { keys: "1", label: "Validate" },
                    { keys: "2", label: "Dismiss" },
                ].map((hint) => (
                    <span key={hint.label} className="flex items-center gap-1.5 text-[11px] font-semibold text-[#475569]">
                        <kbd className="bg-[#F1F5F9] border border-[#E2E8F0] rounded px-1.5 py-0.5 font-mono font-bold text-[10px] text-[#0F172A] min-w-[20px] text-center">
                            {hint.keys}
                        </kbd>
                        {hint.label}
                    </span>
                ))}
                {isStandalone && (
                    <span className="text-[11px] font-semibold text-[#94A3B8]">
                        Opened directly, so stepping through cases is off. Open one from the grid to review in sequence.
                    </span>
                )}
            </div>

            {actionError && (
                <div className="flex items-start gap-2.5 bg-[#FEF2F2] border border-[#FECACA] rounded-2xl px-4 py-3">
                    <TriangleAlert className="w-4 h-4 text-[#DC2626] mt-0.5 shrink-0" />
                    <div>
                        <p className="text-xs font-bold text-[#991B1B]">Decision not saved</p>
                        <p className="text-[11px] font-semibold text-[#B91C1C] mt-0.5">{actionError}</p>
                    </div>
                </div>
            )}

            {/* Evidence, full width */}
            <div className="relative bg-[#0B1528] rounded-[22px] border border-[#E2E8F0] overflow-hidden shadow-sm">
                <div className="aspect-[16/9] w-full flex items-center justify-center">
                    {isLoading ? (
                        <Loader2 className="w-8 h-8 text-[#00DF89] animate-spin" />
                    ) : loadError ? (
                        <div className="flex flex-col items-center gap-3 text-slate-300 px-6 text-center">
                            <TriangleAlert className="w-8 h-8 text-[#F87171]" />
                            <p className="text-xs font-bold">{loadError}</p>
                        </div>
                    ) : !current ? (
                        <div className="flex flex-col items-center gap-2 text-slate-400">
                            <ImageOff className="w-8 h-8" />
                            <span className="text-[11px] font-bold uppercase tracking-widest">
                                Case unavailable
                            </span>
                        </div>
                    ) : videoUrl ? (
                        <video
                            key={videoUrl}
                            src={videoUrl}
                            controls
                            playsInline
                            preload="metadata"
                            className="w-full h-full object-contain"
                        />
                    ) : imageUrl ? (
                        <img
                            key={imageUrl}
                            src={imageUrl}
                            alt={formatDetectionTypeLabel(current.detection_type)}
                            className="w-full h-full object-contain"
                        />
                    ) : (
                        <div className="flex flex-col items-center gap-2 text-slate-400">
                            <ImageOff className="w-8 h-8" />
                            <span className="text-[11px] font-bold uppercase tracking-widest">
                                No media attached
                            </span>
                        </div>
                    )}
                </div>

                {current && videoUrl && (
                    <div className="absolute top-4 left-4 flex items-center gap-1 bg-[#0B1528]/85 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-md">
                        <Film className="w-3 h-3" />
                        <span>VIDEO</span>
                    </div>
                )}

                {/* On-screen equivalents of the arrow keys */}
                {!isStandalone && (
                    <>
                        <button
                            onClick={() => goBy(-1)}
                            disabled={atFirst || isLoading}
                            aria-label="Previous case"
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 hover:bg-white text-[#0F172A] shadow-lg flex items-center justify-center transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => goBy(1)}
                            disabled={atLast || isLoading}
                            aria-label="Next case"
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 hover:bg-white text-[#0F172A] shadow-lg flex items-center justify-center transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                        >
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </>
                )}
            </div>

            {/* Decision bar */}
            <div className="flex flex-col sm:flex-row items-stretch gap-3">
                <button
                    onClick={askCourtReady}
                    disabled={!current || isActing}
                    className={cn(
                        "flex-1 py-3.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none",
                        current?.verification_status === "verified"
                            ? "bg-[#D1FAE5] text-[#065F46] border border-[#A7F3D0]"
                            : "bg-[#00DF89] hover:bg-[#00DF89]/90 text-slate-950 shadow-md shadow-[#00DF89]/20"
                    )}
                >
                    {isActing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[2.5]" />}
                    <span>
                        {current?.verification_status === "verified" ? "Validated" : "Validate"}
                    </span>
                    <kbd className="bg-black/10 rounded px-1.5 py-0.5 font-mono text-[10px]">1</kbd>
                </button>

                <button
                    onClick={() => void runAction("rejected")}
                    disabled={!current || isActing}
                    className={cn(
                        "flex-1 py-3.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none",
                        current?.verification_status === "rejected"
                            ? "bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]"
                            : "bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#475569]"
                    )}
                >
                    <X className="w-4 h-4 stroke-[2.5]" />
                    <span>
                        {current?.verification_status === "rejected" ? "Dismissed" : "Dismiss"}
                    </span>
                    <kbd className="bg-black/10 rounded px-1.5 py-0.5 font-mono text-[10px]">2</kbd>
                </button>
            </div>

            {/* Case record */}
            <div className="bg-white rounded-[22px] border border-[#E2E8F0] shadow-sm p-5 space-y-4">
                <div className="flex items-center gap-4 text-[11px] font-semibold text-[#64748B]">
                    <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-[#94A3B8]" />
                        {current?.username || "Unknown scout"}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#94A3B8]" />
                        {current?.country_code || "Region not recorded"}
                    </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1 border-t border-[#F1F5F9]">
                    <Field label="Violation type" value={current ? formatDetectionTypeLabel(current.detection_type) : null} />
                    <Field label="Status" value={current?.verification_status} />
                    <Field
                        label="Beats earned"
                        value={current ? `${Number(current.beats_earned ?? 0).toFixed(2)} PTS` : null}
                    />
                    <Field label="Frames" value={current?.images?.length ?? null} />
                    <Field label="Latitude" value={current?.latitude ?? null} />
                    <Field label="Longitude" value={current?.longitude ?? null} />
                    <Field label="Captured" value={formatDateTime(current?.captured_at)} />
                    <Field label="Submitted" value={formatDateTime(current?.created_at)} />
                    {current?.verification_status === "verified" && (
                        <Field label="Validated at" value={formatDateTime(current?.verified_at)} />
                    )}
                    {current?.verification_status === "verified" && (
                        <Field
                            label="Court ready"
                            value={
                                current?.court_ready === true
                                    ? "Yes"
                                    : current?.court_ready === false
                                        ? "No"
                                        : null
                            }
                        />
                    )}
                    {current?.verification_status === "rejected" && (
                        <Field label="Dismissal reason" value={current?.rejection_reason} />
                    )}
                </div>
            </div>

            <CourtReadyDialog
                caseLabel={courtPromptFor}
                isSaving={isActing}
                onAnswer={(courtReady) => void answerCourtReady(courtReady)}
                onCancel={() => setCourtPromptFor(null)}
            />
        </div>
    );
}
