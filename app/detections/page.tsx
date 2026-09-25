/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
    Search,
    Shield,
    Clock,
    CheckCircle2,
    XCircle,
    Calendar,
    ChevronDown,
    Loader2,
    MapPin,
    User,
    Check,
    X,
    Maximize2,
    Film,
    ImageOff,
    Gavel
} from "lucide-react";
import { Submission, Stats, DetectionTypeCount, VerificationStatus } from "@/types";
import { cn } from "@/lib/utils";
import CourtReadyDialog from "@/components/detections/CourtReadyDialog";
import {
    DetectionFilters,
    ReviewRange,
    ReviewTab,
    parseFilters,
    GRID_BATCH_SIZE,
    REVIEW_COURT_READY,
    batchIndexFor,
    parsePage,
    resolveDateFrom,
    toReviewParams,
} from "@/lib/detectionFilters";

const filterTabs = [
    { id: "pending", label: "Pending review" },
    { id: "verified", label: "Validated" },
    // A subset of Validated, not a separate status: these cases show in both.
    { id: "court_ready", label: "Court ready" },
    { id: "rejected", label: "Dismissed" },
    // Not a status filter: a progress view across every class.
    { id: "by_class", label: "By class", isView: true },
];

// Friendly names for the classes whose raw value reads poorly; everything else
// is title-cased from the value itself so new classes appear without a code change.
const detectionTypeLabels: Record<string, string> = {
    with_helmet: "With Helmet",
    without_helmet: "Without Helmet",
    DHelmet: "Helmet (Detector)",
    DNoHelmet: "No Helmet (Detector)",
    "rider-with-helmet": "Rider With Helmet",
    "rider-with-nohelmet": "Rider Without Helmet",
    license_plate: "Licence Plate",
    plate: "Plate",
    lane_line: "Lane Line",
    lane_weave: "Lane Weaving",
    ego_lane_change: "Lane Change",
    rashdriving_lane_weave: "Rash Driving / Weaving",
    wrong_way: "Wrong Way",
    sudden_accel: "Sudden Acceleration",
    sharp_turn: "Sharp Turn",
    vehicle: "Vehicle",
};

function formatDetectionTypeLabel(type: string) {
    if (detectionTypeLabels[type]) return detectionTypeLabels[type];
    return type
        .replace(/[_-]+/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function DetectionsPage() {
    // Data state
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [stats, setStats] = useState<Stats>({
        total_submissions: 0,
        verified: 0,
        rejected: 0,
        pending: 0,
        total_frames: 0,
        detection_types: []
    });
    const [isLoading, setIsLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [detectionTypes, setDetectionTypes] = useState<DetectionTypeCount[]>([]);

    // Filter states
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("pending");
    const [violationType, setViolationType] = useState("");
    const [timeRange, setTimeRange] = useState("all");
    /**
     * How many batches of the queue are on screen.
     *
     * The grid is a continuous list rather than pages: a reviewer asked to see
     * all pending work, and 40,000 pending cases at 9 per page is 4,454 pages.
     * Scrolling to the bottom appends the next batch.
     */
    const [batchCount, setBatchCount] = useState(1);

    /** `by_class` renders a progress table instead of the evidence grid. */
    const isClassView = activeTab === "by_class";

    /**
     * Large classes are split into fixed 5,000-image packets. '' is the whole
     * class; 'A', 'B', ... select one packet.
     */
    const [selectedBatch, setSelectedBatch] = useState("");
    const [classBatches, setClassBatches] = useState<
        { label: string; start_rank: number; size: number }[]
    >([]);

    // Filters arrive in the URL when the reviewer comes back from a case, so
    // Back lands on the same slice they left. Read from window.location rather
    // than useSearchParams, which would force a Suspense split of this page.
    const [isHydrated, setIsHydrated] = useState(false);
    useEffect(() => {
        const search = new URLSearchParams(window.location.search);
        const restored = parseFilters(search);
        setActiveTab(restored.tab);
        setViolationType(restored.type);
        setTimeRange(restored.range);
        setSearchQuery(restored.q);
        setSelectedBatch(restored.batch);
        // Coming back from a case: load enough batches to include where they were.
        setBatchCount(batchIndexFor(parsePage(search)) + 1);
        setIsHydrated(true);
    }, []);

    // Fetch stats
    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch("/api/stats");
            if (res.ok) {
                const data = await res.json() as Stats;
                setStats(data);
            }
        } catch {
            // Keep default stats
        }
    }, []);

    // Which fixed packets this class is split into. Empty for small classes.
    useEffect(() => {
        // Before hydration violationType is still empty, and clearing here
        // would wipe a batch restored from the URL.
        if (!isHydrated) return;
        if (!violationType) {
            setClassBatches([]);
            setSelectedBatch("");
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(
                    `/api/detection-batches?detection_type=${encodeURIComponent(violationType)}`
                );
                if (!res.ok) throw new Error("batch lookup failed");
                const data = (await res.json()) as {
                    batches: { label: string; start_rank: number; size: number }[];
                };
                if (cancelled) return;
                setClassBatches(data.batches ?? []);
                // Drop a selection that does not exist in the new class.
                setSelectedBatch((current) =>
                    current && (data.batches ?? []).some((b) => b.label === current) ? current : ""
                );
            } catch {
                if (!cancelled) setClassBatches([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [violationType, isHydrated]);

    // Every detection class present in the data, newest schema included.
    const fetchDetectionTypes = useCallback(async () => {
        try {
            const res = await fetch("/api/detection-types");
            if (res.ok) {
                setDetectionTypes(await res.json() as DetectionTypeCount[]);
            }
        } catch {
            setDetectionTypes([]);
        }
    }, []);

    /**
     * Batched loading.
     *
     * One request brings back GRID_BATCH_PAGES worth of rows and the batch is
     * kept in memory, so moving between pages inside it costs nothing. Batches
     * are keyed by the filter set, and the whole cache is dropped when the
     * filters change because the sequence itself changes.
     */
    const batchCacheRef = useRef<Map<string, Submission[]>>(new Map());
    const totalCacheRef = useRef<Map<string, number>>(new Map());
    const inflightRef = useRef<Map<string, Promise<void>>>(new Map());

    const filterKey = [
        activeTab,
        violationType,
        timeRange,
        searchQuery.trim(),
        selectedBatch,
    ].join("|");

    // A filter change invalidates every cached batch: different rows, different order.
    useEffect(() => {
        batchCacheRef.current.clear();
        totalCacheRef.current.clear();
        inflightRef.current.clear();
    }, [filterKey]);

    const buildParams = useCallback(
        (batchIndex: number, withCount: boolean) => {
            const params = new URLSearchParams();
            params.set("limit", String(GRID_BATCH_SIZE));
            params.set("offset", String(batchIndex * GRID_BATCH_SIZE));
            if (violationType) params.set("detection_type", violationType);
            if (violationType && selectedBatch) params.set("batch", selectedBatch);
            if (activeTab === "court_ready") {
                // Court ready is a subset of verified, not a status of its own.
                params.set("verification_status", "verified");
                params.set("review_status", REVIEW_COURT_READY);
            } else if (activeTab !== "all" && activeTab !== "by_class") {
                params.set("verification_status", activeTab);
            }
            if (searchQuery.trim()) params.set("username", searchQuery.trim());

            const days = timeRange === "today" ? 0 : timeRange === "week" ? 7 : timeRange === "month" ? 30 : null;
            if (days !== null) {
                const from = new Date();
                from.setDate(from.getDate() - days);
                params.set("date_from", from.toISOString().slice(0, 10));
            }
            // The total is the same for every batch of one filter, so it is
            // requested once and reused from the cache after that.
            if (!withCount) params.set("count", "skip");
            return params;
        },
        [activeTab, violationType, selectedBatch, searchQuery, timeRange]
    );

    const loadBatch = useCallback(
        (batchIndex: number): Promise<void> => {
            const key = `${filterKey}#${batchIndex}`;
            if (batchCacheRef.current.has(key)) return Promise.resolve();

            const existing = inflightRef.current.get(key);
            if (existing) return existing;

            const needCount = !totalCacheRef.current.has(filterKey);
            const request = (async () => {
                const res = await fetch(`/api/submissions?${buildParams(batchIndex, needCount).toString()}`);
                if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
                const data = (await res.json()) as {
                    submissions: Submission[];
                    total: number | null;
                };
                batchCacheRef.current.set(key, data.submissions ?? []);
                if (data.total !== null && data.total !== undefined) {
                    totalCacheRef.current.set(filterKey, data.total);
                }
            })().finally(() => {
                inflightRef.current.delete(key);
            });

            inflightRef.current.set(key, request);
            return request;
        },
        [filterKey, buildParams]
    );

    const fetchSubmissions = useCallback(async () => {
        const wanted = Array.from({ length: batchCount }, (_, i) => i);
        const allCached = wanted.every((i) => batchCacheRef.current.has(`${filterKey}#${i}`));

        // Only show the skeleton for a real fetch; cached rows should be instant.
        if (!allCached) setIsLoading(true);

        try {
            await Promise.all(wanted.map((i) => loadBatch(i)));
            const rows = wanted.flatMap((i) => batchCacheRef.current.get(`${filterKey}#${i}`) ?? []);
            setSubmissions(rows);
            setTotal(totalCacheRef.current.get(filterKey) ?? 0);
        } catch {
            setSubmissions([]);
            setTotal(totalCacheRef.current.get(filterKey) ?? 0);
        } finally {
            setIsLoading(false);
        }
    }, [batchCount, filterKey, loadBatch]);

    const loadedCount = submissions.length;
    const hasMore = total > 0 && loadedCount < total;

    /** Appending happens when the sentinel below the last card scrolls into view. */
    const sentinelRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        if (!isHydrated || isLoading || !hasMore || activeTab === "by_class") return;
        const node = sentinelRef.current;
        if (!node) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((e) => e.isIntersecting)) {
                    setBatchCount((n) => n + 1);
                }
            },
            // Start fetching before the sentinel is actually visible.
            { rootMargin: "600px" }
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, [isHydrated, isLoading, hasMore, loadedCount, activeTab]);

    // A filter change collapses the list back to a single batch.
    useEffect(() => {
        setBatchCount(1);
    }, [filterKey]);

    useEffect(() => {
        fetchStats();
        fetchDetectionTypes();
    }, [fetchStats, fetchDetectionTypes]);

    useEffect(() => {
        // Wait for the URL-restored filters, or the first render would fetch
        // the unfiltered page and then immediately refetch.
        if (!isHydrated) return;
        if (activeTab === "by_class") return;

        // The debounce exists to keep typing in the search box from firing a
        // request per keystroke. A page already held in the batch cache needs
        // no request at all, so it should not pay that delay.
        const allCached = Array.from({ length: batchCount }, (_, i) => i).every((i) =>
            batchCacheRef.current.has(`${filterKey}#${i}`)
        );
        if (allCached) {
            void fetchSubmissions();
            return;
        }

        const timer = setTimeout(fetchSubmissions, 350);
        return () => clearTimeout(timer);
    }, [fetchSubmissions, isHydrated, filterKey, batchCount, activeTab]);

    // Handle Actions
    //
    // fetch resolves on 4xx/5xx, so an unchecked response would paint a case
    // green while nothing was written. Local state only moves once the server
    // confirms, and the stat tiles move by the real before/after delta.
    const applyStatsDelta = (before: VerificationStatus | string, after: VerificationStatus) => {
        if (before === after) return;
        setStats((prev) => {
            const next = { ...prev };
            if (before === "verified") next.verified = Math.max(0, next.verified - 1);
            else if (before === "rejected") next.rejected = Math.max(0, next.rejected - 1);
            else next.pending = Math.max(0, next.pending - 1);

            if (after === "verified") next.verified += 1;
            else if (after === "rejected") next.rejected += 1;
            else next.pending += 1;
            return next;
        });
    };

    const [actionError, setActionError] = useState<string | null>(null);
    const actingRef = useRef<string | null>(null);

    /** The case waiting on the court-ready answer, if any. */
    const [courtPromptFor, setCourtPromptFor] = useState<Submission | null>(null);
    /** Mirrors the in-flight gate for rendering; the ref cannot be read here. */
    const [savingId, setSavingId] = useState<string | null>(null);

    const applyDecision = async (
        sub: Submission,
        status: Exclude<VerificationStatus, "pending">,
        e?: React.MouseEvent,
        courtReady?: boolean
    ) => {
        // The media block is a link, so a button inside the card must cancel
        // the navigation as well as the bubble.
        e?.preventDefault();
        e?.stopPropagation();

        if (actingRef.current === sub.id) return;
        actingRef.current = sub.id;
        setSavingId(sub.id);
        setActionError(null);

        const before = sub.verification_status;
        try {
            const res = await fetch(`/api/submissions/${sub.id}/verify`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    status,
                    rejection_reason: status === "rejected" ? "Dismissed by officer" : undefined,
                    court_ready: courtReady,
                }),
            });
            if (!res.ok) {
                const detail = await res.json().catch(() => null) as { error?: string } | null;
                throw new Error(detail?.error ?? `Update failed (HTTP ${res.status})`);
            }
            const saved = await res.json() as {
                verification_status: VerificationStatus;
                rejection_reason: string | null;
                verified_at: string | null;
                court_ready: boolean | null;
                review_status: string | null;
            };

            setSubmissions((prev) =>
                prev.map((s) =>
                    s.id === sub.id
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
            applyStatsDelta(before, saved.verification_status);
        } catch (err) {
            setActionError((err as Error)?.message ?? "Could not save this decision.");
        } finally {
            actingRef.current = null;
            setSavingId(null);
        }
    };

    const handleVerify = (sub: Submission, e?: React.MouseEvent) => {
        // The media block is a link, so the button must cancel navigation too.
        e?.preventDefault();
        e?.stopPropagation();
        if (actingRef.current === sub.id) return;
        setActionError(null);
        setCourtPromptFor(sub);
    };
    const handleDismiss = (sub: Submission, e?: React.MouseEvent) => applyDecision(sub, "rejected", e);

    /** The count a class contributes to whichever tab is open. */
    const countForTab = (type: DetectionTypeCount) => {
        if (activeTab === "verified") return type.verified ?? 0;
        if (activeTab === "rejected") return type.rejected ?? 0;
        if (activeTab === "court_ready") return type.court_ready ?? 0;
        if (activeTab === "pending") return type.pending;
        return type.total;
    };

    // Most work left first: that is the question the table answers.
    const classRows = [...detectionTypes].sort((a, b) => b.pending - a.pending);
    const classTotals = classRows.reduce(
        (acc, c) => ({
            total: acc.total + c.total,
            pending: acc.pending + c.pending,
            verified: acc.verified + (c.verified ?? 0),
            rejected: acc.rejected + (c.rejected ?? 0),
            court: acc.court + (c.court_ready ?? 0),
        }),
        { total: 0, pending: 0, verified: 0, rejected: 0, court: 0 }
    );

    // Filtering and paging are done server-side; render exactly what came back.
    const displaySubmissions = submissions;

    // Exactly the filter set the API call used, handed to the review page so it
    // walks the same ordered sequence.
    const gridFilters: DetectionFilters = {
        tab: activeTab as ReviewTab,
        type: violationType,
        range: timeRange as ReviewRange,
        from: resolveDateFrom(timeRange as ReviewRange),
        q: searchQuery.trim(),
        batch: selectedBatch,
    };

    // Helpers for case ID & status badges matching image
    const formatCaseId = (id: string, index: number) => {
        const num = id.replace(/\D/g, "");
        if (num.length >= 4) return num.slice(0, 5);
        return `0${2500 + index * 12}`;
    };

    const getStatusPill = (status: string) => {
        if (status === "pending") {
            return (
                <span className="bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] text-[11px] font-bold px-3 py-1 rounded-full shadow-sm">
                    Pending review
                </span>
            );
        }
        if (status === "verified") {
            return (
                <span className="bg-[#D1FAE5] text-[#065F46] border border-[#A7F3D0] text-[11px] font-bold px-3 py-1 rounded-full shadow-sm">
                    Validated
                </span>
            );
        }
        return (
            <span className="bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0] text-[11px] font-bold px-3 py-1 rounded-full shadow-sm">
                Dismissed
            </span>
        );
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300 pb-16 font-sans">
            {/* Header matching image */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-2">
                <div>
                    <h1 className="text-3xl font-extrabold text-[#0F172A] tracking-tight">
                        Violation Review Centre
                    </h1>
                    <p className="text-sm font-medium text-[#64748B] mt-1">
                        Validate AI-detected traffic violations and review verified cases.
                    </p>
                </div>

                {/* Search Bar matching image */}
                <div className="relative w-full md:w-80">
                    <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search case ID or violation"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white border border-[#E2E8F0] rounded-2xl pl-10 pr-4 py-2.5 text-sm font-medium text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#00DF89]/30 focus:border-[#00DF89] shadow-sm transition-all"
                    />
                </div>
            </div>

            {/* 4 Stat Cards matching image */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total evidence */}
                <div className="bg-white rounded-[20px] border border-[#E2E8F0] p-5 shadow-sm flex items-start justify-between">
                    <div>
                        <p className="text-xs font-semibold text-[#64748B]">Total evidence</p>
                        <p className="text-2xl lg:text-3xl font-black text-[#0F172A] tracking-tight mt-1 font-mono tabular-nums">
                            {stats.total_submissions.toLocaleString()}
                        </p>
                        <p className="text-[11px] font-medium text-[#94A3B8] mt-1.5">
                            AI detections received
                        </p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-[#F1F5F9] flex items-center justify-center text-[#475569] shrink-0">
                        <Shield className="w-5 h-5" />
                    </div>
                </div>

                {/* Pending validation */}
                <div className="bg-white rounded-[20px] border border-[#E2E8F0] p-5 shadow-sm flex items-start justify-between">
                    <div>
                        <p className="text-xs font-semibold text-[#64748B]">Pending validation</p>
                        <p className="text-2xl lg:text-3xl font-black text-[#0F172A] tracking-tight mt-1 font-mono tabular-nums">
                            {stats.pending.toLocaleString()}
                        </p>
                        <p className="text-[11px] font-medium text-[#94A3B8] mt-1.5">
                            Needs officer review
                        </p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-[#FEF3C7] flex items-center justify-center text-[#D97706] shrink-0">
                        <Clock className="w-5 h-5" />
                    </div>
                </div>

                {/* Validated */}
                <div className="bg-white rounded-[20px] border border-[#E2E8F0] p-5 shadow-sm flex items-start justify-between">
                    <div>
                        <p className="text-xs font-semibold text-[#64748B]">Validated</p>
                        <p className="text-2xl lg:text-3xl font-black text-[#0F172A] tracking-tight mt-1 font-mono tabular-nums">
                            {stats.verified.toLocaleString()}
                        </p>
                        <p className="text-[11px] font-medium text-[#94A3B8] mt-1.5">
                            Ready for enforcement
                        </p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-[#D1FAE5] flex items-center justify-center text-[#059669] shrink-0">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                </div>

                {/* Dismissed */}
                <div className="bg-white rounded-[20px] border border-[#E2E8F0] p-5 shadow-sm flex items-start justify-between">
                    <div>
                        <p className="text-xs font-semibold text-[#64748B]">Dismissed</p>
                        <p className="text-2xl lg:text-3xl font-black text-[#0F172A] tracking-tight mt-1 font-mono tabular-nums">
                            {stats.rejected.toLocaleString()}
                        </p>
                        <p className="text-[11px] font-medium text-[#94A3B8] mt-1.5">
                            Rejected after review
                        </p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-[#F1F5F9] flex items-center justify-center text-[#475569] shrink-0">
                        <XCircle className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* Filter Bar matching image */}
            <div className="bg-white rounded-[20px] p-2.5 border border-[#E2E8F0] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Left Pills */}
                <div className="flex flex-wrap items-center gap-1.5">
                    {filterTabs.map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setActiveTab(tab.id);
                                    setBatchCount(1);
                                }}
                                className={cn(
                                    "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                                    isActive
                                        ? "bg-[#0B1528] text-white shadow-sm"
                                        : "text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]"
                                )}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Right Dropdowns matching image */}
                <div className="flex items-center gap-3">
                    {/* Violations Dropdown */}
                    <div className="relative">
                        <select
                            value={violationType}
                            onChange={(e) => {
                                setViolationType(e.target.value);
                                setSelectedBatch("");
                                setBatchCount(1);
                            }}
                            className="appearance-none bg-white border border-[#E2E8F0] rounded-xl px-4 py-2 pr-9 text-xs font-semibold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#00DF89]/30 cursor-pointer shadow-sm"
                        >
                            <option value="">All classes ({detectionTypes.length})</option>
                            {detectionTypes.map((type) => (
                                <option key={type.detection_type} value={type.detection_type}>
                                    {formatDetectionTypeLabel(type.detection_type)} ({countForTab(type).toLocaleString()})
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    {/* Fixed 5,000-image packets; only shown for classes big
                        enough to be split. */}
                    {classBatches.length > 1 && (
                        <div className="relative">
                            <select
                                value={selectedBatch}
                                onChange={(e) => {
                                    setSelectedBatch(e.target.value);
                                    setBatchCount(1);
                                }}
                                className="appearance-none bg-white border border-[#E2E8F0] rounded-xl px-4 py-2 pr-9 text-xs font-semibold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#00DF89]/30 cursor-pointer shadow-sm"
                            >
                                <option value="">
                                    Whole class ({classBatches.length} batches)
                                </option>
                                {classBatches.map((b) => (
                                    <option key={b.label} value={b.label}>
                                        Batch {b.label} &mdash; {b.start_rank.toLocaleString()}–
                                        {(b.start_rank + b.size - 1).toLocaleString()} ({b.size.toLocaleString()})
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                    )}

                    {/* Time Dropdown with Calendar Icon */}
                    <div className="relative">
                        <div className="flex items-center gap-2 bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-xs font-semibold text-[#0F172A] shadow-sm">
                            <Calendar className="w-3.5 h-3.5 text-[#94A3B8]" />
                            <select
                                value={timeRange}
                                onChange={(e) => { setTimeRange(e.target.value); setBatchCount(1); }}
                                className="appearance-none bg-transparent pr-5 text-xs font-semibold text-[#0F172A] focus:outline-none cursor-pointer"
                            >
                                <option value="all">All time</option>
                                <option value="today">Today</option>
                                <option value="week">Past 7 days</option>
                                <option value="month">Past 30 days</option>
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                    </div>
                </div>
            </div>

            {isClassView ? (
                <div className="bg-white rounded-[22px] border border-[#E2E8F0] shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-[#E2E8F0] flex flex-wrap items-baseline justify-between gap-2">
                        <div>
                            <h2 className="text-sm font-extrabold text-[#0F172A]">Review progress by class</h2>
                            <p className="text-[11px] font-medium text-[#64748B] mt-0.5">
                                Total is the all-time size of a class and does not fall as cases are
                                reviewed. Remaining is what still needs an officer.
                            </p>
                        </div>
                        <span className="text-[11px] font-bold text-[#64748B] font-mono">
                            {classTotals.pending.toLocaleString()} of {classTotals.total.toLocaleString()} remaining
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                                <tr>
                                    {["CLASS", "PROGRESS", "REMAINING", "VALIDATED", "COURT READY", "DISMISSED", "TOTAL"].map(
                                        (h, i) => (
                                            <th
                                                key={h}
                                                className={cn(
                                                    "px-5 py-3 text-[10px] font-bold text-[#64748B] uppercase tracking-wider",
                                                    i > 1 && "text-right"
                                                )}
                                            >
                                                {h}
                                            </th>
                                        )
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F1F5F9]">
                                {classRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-16 text-center text-sm text-[#94A3B8]">
                                            No detection classes to show.
                                        </td>
                                    </tr>
                                ) : (
                                    classRows.map((c) => {
                                        const done = c.total - c.pending;
                                        const pct = c.total > 0 ? Math.round((done / c.total) * 100) : 0;
                                        const complete = c.pending === 0 && c.total > 0;

                                        return (
                                            <tr
                                                key={c.detection_type}
                                                onClick={() => {
                                                    // Jump straight into the remaining work for this class.
                                                    setViolationType(c.detection_type);
                                                    setActiveTab(complete ? "verified" : "pending");
                                                    setBatchCount(1);
                                                }}
                                                className="hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                                            >
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-[#0F172A]">
                                                            {formatDetectionTypeLabel(c.detection_type)}
                                                        </span>
                                                        {complete && (
                                                            <span className="bg-[#D1FAE5] text-[#065F46] border border-[#A7F3D0] text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                                Done
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-2 min-w-[140px]">
                                                        <div className="flex-1 h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
                                                            <div
                                                                className={cn(
                                                                    "h-full rounded-full",
                                                                    complete ? "bg-[#00DF89]" : "bg-[#2563EB]"
                                                                )}
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-[11px] font-bold text-[#64748B] font-mono w-9 text-right">
                                                            {pct}%
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 text-right text-xs font-bold text-[#0F172A] font-mono">
                                                    {c.pending.toLocaleString()}
                                                </td>
                                                <td className="px-5 py-4 text-right text-xs font-bold text-[#059669] font-mono">
                                                    {(c.verified ?? 0).toLocaleString()}
                                                </td>
                                                <td className="px-5 py-4 text-right text-xs font-bold text-[#1D4ED8] font-mono">
                                                    {(c.court_ready ?? 0).toLocaleString()}
                                                </td>
                                                <td className="px-5 py-4 text-right text-xs font-bold text-[#94A3B8] font-mono">
                                                    {(c.rejected ?? 0).toLocaleString()}
                                                </td>
                                                <td className="px-5 py-4 text-right text-xs font-semibold text-[#64748B] font-mono">
                                                    {c.total.toLocaleString()}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    <p className="px-5 py-3 border-t border-[#E2E8F0] text-[11px] font-medium text-[#64748B]">
                        Click a class to open its remaining cases.
                    </p>
                </div>
            ) : (
            <>
            {/* Evidence Records Counter matching image */}
            <div className="flex items-center justify-between text-xs text-[#64748B] font-semibold px-1">
                <span>
                    Showing {displaySubmissions.length.toLocaleString()} of{" "}
                    {total.toLocaleString()} {activeTab === "pending" ? "pending" : "matching"} records
                    {selectedBatch && (
                        <span className="text-[#1D4ED8]">
                            {" "}
                            in {formatDetectionTypeLabel(violationType)} batch {selectedBatch}
                        </span>
                    )}
                </span>
                <span className="text-[#94A3B8]">Click any frame to review it full screen</span>
            </div>

            {actionError && (
                <div className="flex items-start gap-2.5 bg-[#FEF2F2] border border-[#FECACA] rounded-2xl px-4 py-3">
                    <XCircle className="w-4 h-4 text-[#DC2626] mt-0.5 shrink-0" />
                    <div>
                        <p className="text-xs font-bold text-[#991B1B]">Decision not saved</p>
                        <p className="text-[11px] font-semibold text-[#B91C1C] mt-0.5">{actionError}</p>
                    </div>
                </div>
            )}

            {/* Evidence Grid matching image (3 columns) */}
            {isLoading ? (
                <div className="py-24 flex flex-col items-center justify-center gap-4 bg-white rounded-3xl border border-[#E2E8F0] shadow-sm">
                    <Loader2 className="w-8 h-8 text-[#00DF89] animate-spin" />
                    <p className="text-xs text-[#64748B] font-bold uppercase tracking-widest">Loading evidence frames...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {displaySubmissions.map((sub, idx) => {
                        const primaryImg = sub.images?.find((img) => img.is_primary) || sub.images?.[0];
                        const imgUrl = primaryImg?.image_url;
                        const videoUrl = sub.video_asset?.url;
                        const caseId = formatCaseId(sub.id, idx);
                        const reviewParams = toReviewParams(gridFilters, idx, total);
                        reviewParams.set("id", sub.id);
                        const reviewHref = `/detections/review?${reviewParams.toString()}`;

                        return (
                            <div
                                key={sub.id}
                                className="bg-white rounded-[22px] border border-[#E2E8F0] shadow-sm overflow-hidden hover:shadow-md transition-all duration-200 group flex flex-col"
                            >
                                {/* Media opens the case full screen. Only this block is
                                    the anchor, so Validate and Dismiss stay clickable. */}
                                <Link
                                    href={reviewHref}
                                    className="relative block aspect-[16/10] bg-[#0B1528] overflow-hidden cursor-pointer"
                                >
                                    {/* ID Badge Top Left */}
                                    <div className="absolute top-3.5 left-3.5 z-10 bg-[#0B1528]/85 backdrop-blur-md text-white text-[11px] font-mono font-bold px-2.5 py-1 rounded-md shadow-sm">
                                        {caseId}
                                    </div>

                                    {/* Status Badge Top Right */}
                                    <div className="absolute top-3.5 right-3.5 z-10 flex flex-col items-end gap-1.5">
                                        {getStatusPill(sub.verification_status)}
                                        {sub.review_status === REVIEW_COURT_READY && (
                                            <span className="bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                                                <Gavel className="w-2.5 h-2.5" />
                                                Court ready
                                            </span>
                                        )}
                                    </div>

                                    {/* Evidence media: clip, frame, or an honest placeholder */}
                                    {videoUrl ? (
                                        <>
                                            <video
                                                src={videoUrl}
                                                muted
                                                playsInline
                                                preload="metadata"
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute bottom-3.5 left-3.5 z-10 flex items-center gap-1 bg-[#0B1528]/85 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-md">
                                                <Film className="w-3 h-3" />
                                                <span>VIDEO</span>
                                            </div>
                                        </>
                                    ) : imgUrl ? (
                                        <img
                                            src={imgUrl}
                                            alt={sub.detection_type || "Violation evidence"}
                                            loading="lazy"
                                            decoding="async"
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[#64748B]">
                                            <ImageOff className="w-7 h-7" />
                                            <span className="text-[10px] font-bold uppercase tracking-widest">No media</span>
                                        </div>
                                    )}

                                    {/* Hover Inspector Overlay */}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <div className="px-3.5 py-2 rounded-xl bg-white/90 backdrop-blur-md text-slate-900 text-xs font-bold flex items-center gap-1.5 shadow-lg">
                                            <Maximize2 className="w-3.5 h-3.5" />
                                            <span>Open full screen</span>
                                        </div>
                                    </div>
                                </Link>

                                {/* Case Meta & Actions below Image */}
                                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                                    <div>
                                        <div className="flex items-center justify-between gap-2">
                                            <h3 className="font-extrabold text-[#0F172A] text-sm tracking-tight capitalize truncate">
                                                {sub.detection_type?.replace(/_/g, " ") || "Traffic Violation"}
                                            </h3>
                                            <span className="text-[10px] font-mono font-bold text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded">
                                                {sub.beats_earned ? `${sub.beats_earned} beats` : "0.20 beats"}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-3 text-[11px] text-[#64748B] font-medium mt-1.5">
                                            <span className="flex items-center gap-1">
                                                <User className="w-3 h-3 text-[#94A3B8]" />
                                                {sub.username || "Scout"}
                                            </span>
                                            <span>•</span>
                                            <span className="flex items-center gap-1">
                                                <MapPin className="w-3 h-3 text-[#94A3B8]" />
                                                {sub.country_code === "IN" ? "India" : sub.country_code || "IN"}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-2 pt-2 border-t border-[#F1F5F9]">
                                        <button
                                            onClick={(e) => handleVerify(sub, e)}
                                            className={cn(
                                                "flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                                                sub.verification_status === "verified"
                                                    ? "bg-[#D1FAE5] text-[#065F46]"
                                                    : "bg-[#00DF89] hover:bg-[#00DF89]/90 text-slate-950 shadow-sm"
                                            )}
                                        >
                                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                            <span>{sub.verification_status === "verified" ? "Validated" : "Validate"}</span>
                                        </button>

                                        <button
                                            onClick={(e) => handleDismiss(sub, e)}
                                            className={cn(
                                                "py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center",
                                                sub.verification_status === "rejected"
                                                    ? "bg-[#FEE2E2] text-[#991B1B]"
                                                    : "bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#64748B]"
                                            )}
                                            title="Dismiss violation"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            </>
            )}

            <CourtReadyDialog
                caseLabel={courtPromptFor ? courtPromptFor.id : null}
                isSaving={savingId !== null && savingId === courtPromptFor?.id}
                onAnswer={(courtReady) => {
                    const sub = courtPromptFor;
                    if (!sub) return;
                    // Stay open through the save so the spinner is visible.
                    void applyDecision(sub, "verified", undefined, courtReady).finally(() =>
                        setCourtPromptFor(null)
                    );
                }}
                onCancel={() => setCourtPromptFor(null)}
            />

            {/* Sentinel: scrolling near it appends the next batch */}
            {!isLoading && hasMore && (
                <div ref={sentinelRef} className="py-8 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 text-[#00DF89] animate-spin" />
                    <span className="text-xs font-bold text-[#64748B] uppercase tracking-widest">
                        Loading more evidence&hellip;
                    </span>
                </div>
            )}

            {!isLoading && !hasMore && displaySubmissions.length > 0 && (
                <p className="py-8 text-center text-xs font-semibold text-[#94A3B8]">
                    End of queue &mdash; {total.toLocaleString()}{" "}
                    {total === 1 ? "record" : "records"}
                </p>
            )}

            <CourtReadyDialog
                caseLabel={courtPromptFor ? courtPromptFor.id : null}
                isSaving={savingId !== null && savingId === courtPromptFor?.id}
                onAnswer={(courtReady) => {
                    const sub = courtPromptFor;
                    if (!sub) return;
                    // Stay open through the save so the spinner is visible.
                    void applyDecision(sub, "verified", undefined, courtReady).finally(() =>
                        setCourtPromptFor(null)
                    );
                }}
                onCancel={() => setCourtPromptFor(null)}
            />

        </div>
    );
}
