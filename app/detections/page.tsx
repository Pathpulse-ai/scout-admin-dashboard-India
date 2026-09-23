"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    Filter,
    Search,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Calendar,
    Globe,
    Film,
    LogOut
} from "lucide-react";
import DetectionCard from "@/components/detections/DetectionCard";
import PageHeader from "@/components/layout/PageHeader";
import {
    INITIAL_SUBMISSIONS,
    INITIAL_COUNTRIES,
    INITIAL_DETECTION_TYPES
} from "@/lib/mock-detections";
import { Submission } from "@/types";
import { cn } from "@/lib/utils";

const statuses = [
    { id: "", label: "All Status" },
    { id: "pending", label: "Pending" },
    { id: "verified", label: "Verified" },
    { id: "rejected", label: "Rejected" },
];

const mediaTypes = [
    { id: "", label: "All Media" },
    { id: "image", label: "Images Only" },
    { id: "video", label: "Videos Only" },
];

const detectionTypeLabels: Record<string, string> = {
    without_helmet: "No Helmet",
    DHelmet: "Helmet",
    license: "Plate",
    "license-plate": "Plate",
    lane: "Lane",
    vehicle: "Vehicle",
};

function formatDetectionTypeLabel(type: string) {
    if (detectionTypeLabels[type]) {
        return detectionTypeLabels[type];
    }

    return type
        .replace(/[_-]+/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function DetectionsGallery() {
    const router = useRouter();

    // Data state initialized from mock data (no API dependency)
    const [allSubmissions, setAllSubmissions] = useState<Submission[]>(INITIAL_SUBMISSIONS);
    const countries = INITIAL_COUNTRIES;
    const detectionTypes = INITIAL_DETECTION_TYPES;

    // Filter states
    const [page, setPage] = useState(0);
    const [filter, setFilter] = useState("");
    const [status, setStatus] = useState("");
    const [country, setCountry] = useState("");
    const [mediaType, setMediaType] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [username, setUsername] = useState("");

    const limit = 6;

    const categories = [
        { id: "", label: "All Types" },
        ...detectionTypes.map((type) => ({
            id: type.detection_type,
            label: formatDetectionTypeLabel(type.detection_type),
        })),
    ];

    // Client-side filtering logic
    const filteredSubmissions = useMemo(() => {
        return allSubmissions.filter((sub) => {
            // Detection Type filter
            if (filter && sub.detection_type !== filter) {
                return false;
            }
            // Status filter
            if (status && sub.verification_status !== status) {
                return false;
            }
            // Country filter
            if (country && sub.country_code !== country) {
                return false;
            }
            // Media Type filter
            if (mediaType === "video" && !sub.video_asset) {
                return false;
            }
            if (mediaType === "image" && sub.video_asset) {
                return false;
            }
            // Username search
            if (username.trim()) {
                const query = username.toLowerCase().trim();
                const matchesUser = sub.username.toLowerCase().includes(query);
                const matchesName = sub.user_name?.toLowerCase().includes(query);
                if (!matchesUser && !matchesName) return false;
            }
            // Date filter
            if (dateFrom) {
                const subDate = new Date(sub.created_at).toISOString().slice(0, 10);
                if (subDate < dateFrom) return false;
            }
            if (dateTo) {
                const subDate = new Date(sub.created_at).toISOString().slice(0, 10);
                if (subDate > dateTo) return false;
            }
            return true;
        });
    }, [allSubmissions, filter, status, country, mediaType, username, dateFrom, dateTo]);

    // Paginated subset
    const total = filteredSubmissions.length;
    const paginatedSubmissions = useMemo(() => {
        const start = page * limit;
        return filteredSubmissions.slice(start, start + limit);
    }, [filteredSubmissions, page, limit]);

    // In-memory verification handler
    const handleVerify = async (id: string) => {
        setAllSubmissions((prev) =>
            prev.map((s) =>
                s.id === id
                    ? {
                          ...s,
                          verification_status: "verified",
                          verified_at: new Date().toISOString(),
                          rejection_reason: null,
                      }
                    : s
            )
        );
        return true;
    };

    // In-memory rejection handler
    const handleReject = async (id: string) => {
        setAllSubmissions((prev) =>
            prev.map((s) =>
                s.id === id
                    ? {
                          ...s,
                          verification_status: "rejected",
                          rejection_reason: "Manual verification rejected by operator",
                      }
                    : s
            )
        );
        return true;
    };

    const resetFilters = () => {
        setFilter("");
        setStatus("");
        setCountry("");
        setMediaType("");
        setDateFrom("");
        setDateTo("");
        setUsername("");
        setPage(0);
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
            {/* Page Header with Sign Out Action */}
            <PageHeader
                title="Detection Records"
                subtitle="Pages / Investigator"
                actions={
                    <div className="flex items-center gap-3">
                        <button
                            onClick={resetFilters}
                            className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border-subtle text-muted-foreground text-xs font-bold uppercase tracking-wider rounded-xl hover:text-brand-blue hover:border-brand-blue/30 transition-all shadow-sm active:scale-95"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Reset Filters</span>
                        </button>
                        <button
                            onClick={() => router.push("/")}
                            className="flex items-center gap-2 px-4 py-2.5 bg-danger-background border border-danger/20 text-danger text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-danger/20 transition-all shadow-sm active:scale-95"
                            title="Back to Login page"
                        >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Sign Out</span>
                        </button>
                    </div>
                }
            />

            {/* Filter Bar & Controls */}
            <div className="space-y-4">
                {/* Search & Main Selects */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="relative md:col-span-2">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gray" />
                        <input
                            type="text"
                            placeholder="Search by username..."
                            value={username}
                            onChange={(e) => {
                                setUsername(e.target.value);
                                setPage(0);
                            }}
                            className="w-full bg-card border border-border-subtle rounded-2xl py-3.5 pl-11 pr-4 text-sm font-semibold text-foreground focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue outline-none transition-all placeholder:text-muted-foreground/50 shadow-sm"
                        />
                    </div>
                    <div className="relative">
                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gray" />
                        <select
                            value={country}
                            onChange={(e) => {
                                setCountry(e.target.value);
                                setPage(0);
                            }}
                            className="w-full bg-card border border-border-subtle rounded-2xl py-3.5 pl-11 pr-4 text-sm font-semibold text-foreground focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue outline-none cursor-pointer shadow-sm appearance-none"
                        >
                            <option value="">All Regions</option>
                            {countries.map((c) => (
                                <option key={c.country_code} value={c.country_code}>
                                    {c.country_name || c.country_code} ({c.count})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="relative">
                        <Film className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gray" />
                        <select
                            value={mediaType}
                            onChange={(e) => {
                                setMediaType(e.target.value);
                                setPage(0);
                            }}
                            className="w-full bg-card border border-border-subtle rounded-2xl py-3.5 pl-11 pr-4 text-sm font-semibold text-foreground focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue outline-none cursor-pointer shadow-sm appearance-none"
                        >
                            {mediaTypes.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {m.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Categories & Dates */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-4 lg:p-5 bg-card rounded-2xl border border-border-subtle shadow-sm">
                    <div className="flex flex-wrap gap-2 items-center">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-background rounded-xl text-brand-gray text-[10px] font-bold uppercase tracking-widest mr-1">
                            <Filter className="w-3.5 h-3.5" />
                            Type
                        </div>
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => {
                                    setFilter(cat.id);
                                    setPage(0);
                                }}
                                className={cn(
                                    "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95",
                                    filter === cat.id
                                        ? "bg-brand-blue text-white shadow-md shadow-brand-blue/20"
                                        : "bg-background text-brand-gray hover:bg-brand-blue/10 hover:text-foreground"
                                )}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full lg:w-auto border-t lg:border-t-0 lg:border-l border-border-subtle pt-3 lg:pt-0 lg:pl-5">
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Calendar className="w-4 h-4 text-brand-gray shrink-0" />
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => {
                                    setDateFrom(e.target.value);
                                    setPage(0);
                                }}
                                className="bg-background border border-border-subtle rounded-xl px-2.5 py-1.5 text-xs font-semibold text-foreground outline-none focus:border-brand-blue transition-colors"
                            />
                            <span className="text-brand-gray font-black">-</span>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => {
                                    setDateTo(e.target.value);
                                    setPage(0);
                                }}
                                className="bg-background border border-border-subtle rounded-xl px-2.5 py-1.5 text-xs font-semibold text-foreground outline-none focus:border-brand-blue transition-colors"
                            />
                        </div>
                        <select
                            value={status}
                            onChange={(e) => {
                                setStatus(e.target.value);
                                setPage(0);
                            }}
                            className="bg-background border border-border-subtle rounded-xl px-3 py-1.5 text-xs font-semibold text-foreground outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-colors cursor-pointer"
                        >
                            {statuses.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Submissions List */}
            <div className="flex flex-col gap-5">
                {paginatedSubmissions.map((sub) => (
                    <DetectionCard
                        key={sub.id}
                        submission={sub}
                        onVerify={handleVerify}
                        onReject={handleReject}
                    />
                ))}

                {paginatedSubmissions.length === 0 && (
                    <div className="py-24 text-center space-y-4 bg-card/60 rounded-3xl border-2 border-dashed border-border-subtle">
                        <div className="w-20 h-20 bg-background rounded-full flex items-center justify-center mx-auto shadow-inner">
                            <Search className="w-8 h-8 text-brand-gray/50" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-lg font-extrabold text-foreground tracking-tight">Zero findings detected</p>
                            <p className="text-xs text-brand-gray max-w-sm mx-auto">
                                No records match your query. Try broadening your criteria or click &quot;Reset Filters&quot;.
                            </p>
                        </div>
                        <button
                            onClick={resetFilters}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-blue text-white text-xs font-bold rounded-xl shadow-md shadow-brand-blue/20 hover:bg-brand-blue/90 transition-all"
                        >
                            <RefreshCw className="w-3 h-3" />
                            Reset Filters
                        </button>
                    </div>
                )}
            </div>

            {/* Sticky Pagination Bar */}
            {total > 0 && (
                <div className="sticky bottom-6 mx-auto max-w-fit mt-8 flex items-center gap-4 bg-card/90 backdrop-blur-md border border-border-subtle rounded-full px-5 py-2.5 shadow-xl z-40">
                    <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest hidden sm:block">
                        Showing <span className="text-foreground">{page * limit + 1}-{Math.min((page + 1) * limit, total)}</span> of{" "}
                        <span className="text-foreground">{total}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            disabled={page === 0}
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                            className="p-1.5 rounded-full bg-background border border-border-subtle text-foreground hover:border-brand-blue disabled:opacity-40 disabled:hover:border-border-subtle transition-all active:scale-95"
                            aria-label="Previous Page"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="px-3.5 py-0.5 flex items-center justify-center text-xs font-bold bg-background border border-border-subtle rounded-full text-foreground min-w-10">
                            {page + 1} <span className="text-muted-foreground font-normal ml-1">/ {Math.ceil(total / limit) || 1}</span>
                        </div>
                        <button
                            disabled={(page + 1) * limit >= total}
                            onClick={() => setPage((p) => p + 1)}
                            className="p-1.5 rounded-full bg-background border border-border-subtle text-foreground hover:border-brand-blue disabled:opacity-40 disabled:hover:border-border-subtle transition-all active:scale-95"
                            aria-label="Next Page"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
