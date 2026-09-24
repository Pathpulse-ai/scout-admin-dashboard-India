/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
    Search,
    Shield,
    Clock,
    CheckCircle2,
    XCircle,
    Calendar,
    ChevronDown,
    Loader2,
    ChevronLeft,
    ChevronRight,
    MapPin,
    User,
    Check,
    X,
    Maximize2,
    Film,
    ImageOff
} from "lucide-react";
import { Submission, Stats, DetectionTypeCount } from "@/types";
import { cn } from "@/lib/utils";

const filterTabs = [
    { id: "all", label: "All cases" },
    { id: "pending", label: "Pending review" },
    { id: "verified", label: "Validated" },
    { id: "rejected", label: "Dismissed" },
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
    const [activeTab, setActiveTab] = useState("all");
    const [violationType, setViolationType] = useState("");
    const [timeRange, setTimeRange] = useState("all");
    const [page, setPage] = useState(0);
    const limit = 9;

    // Modal state for viewing evidence in detail
    const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);

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

    // Fetch submissions
    const fetchSubmissions = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            params.set("limit", String(limit));
            params.set("offset", String(page * limit));
            if (violationType) params.set("detection_type", violationType);
            if (activeTab === "pending") params.set("verification_status", "pending");
            if (activeTab === "verified") params.set("verification_status", "verified");
            if (activeTab === "rejected") params.set("verification_status", "rejected");
            if (searchQuery.trim()) params.set("username", searchQuery.trim());

            const days = timeRange === "today" ? 0 : timeRange === "week" ? 7 : timeRange === "month" ? 30 : null;
            if (days !== null) {
                const from = new Date();
                from.setDate(from.getDate() - days);
                params.set("date_from", from.toISOString().slice(0, 10));
            }

            const res = await fetch(`/api/submissions?${params.toString()}`);
            if (!res.ok) throw new Error("API call failed");
            const data = await res.json() as { submissions: Submission[]; total: number };
            setSubmissions(data.submissions ?? []);
            setTotal(data.total ?? 0);
        } catch {
            setSubmissions([]);
            setTotal(0);
        } finally {
            setIsLoading(false);
        }
    }, [page, violationType, activeTab, searchQuery, timeRange]);

    useEffect(() => {
        fetchStats();
        fetchDetectionTypes();
    }, [fetchStats, fetchDetectionTypes]);

    useEffect(() => {
        const timer = setTimeout(fetchSubmissions, 350);
        return () => clearTimeout(timer);
    }, [fetchSubmissions]);

    // Handle Actions
    const handleVerify = async (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        try {
            await fetch(`/api/submissions/${id}/verify`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "verified" }),
            });
            setSubmissions((prev) =>
                prev.map((s) => (s.id === id ? { ...s, verification_status: "verified" } : s))
            );
            setStats((prev) => ({
                ...prev,
                verified: prev.verified + 1,
                pending: Math.max(0, prev.pending - 1)
            }));
            if (selectedSubmission?.id === id) {
                setSelectedSubmission((prev) => prev ? { ...prev, verification_status: "verified" } : null);
            }
        } catch {
            // Optimistic fallback
            setSubmissions((prev) =>
                prev.map((s) => (s.id === id ? { ...s, verification_status: "verified" } : s))
            );
        }
    };

    const handleDismiss = async (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        try {
            await fetch(`/api/submissions/${id}/verify`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "rejected", rejection_reason: "Dismissed by officer" }),
            });
            setSubmissions((prev) =>
                prev.map((s) => (s.id === id ? { ...s, verification_status: "rejected", rejection_reason: "Dismissed by officer" } : s))
            );
            setStats((prev) => ({
                ...prev,
                rejected: prev.rejected + 1,
                pending: Math.max(0, prev.pending - 1)
            }));
            if (selectedSubmission?.id === id) {
                setSelectedSubmission((prev) => prev ? { ...prev, verification_status: "rejected" } : null);
            }
        } catch {
            setSubmissions((prev) =>
                prev.map((s) => (s.id === id ? { ...s, verification_status: "rejected" } : s))
            );
        }
    };

    // Filtering and paging are done server-side; render exactly what came back.
    const displaySubmissions = submissions;

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
                        <p className="text-3xl font-black text-[#0F172A] tracking-tight mt-1 font-mono">
                            {stats.total_submissions}
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
                        <p className="text-3xl font-black text-[#0F172A] tracking-tight mt-1 font-mono">
                            {stats.pending}
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
                        <p className="text-3xl font-black text-[#0F172A] tracking-tight mt-1 font-mono">
                            {stats.verified}
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
                        <p className="text-3xl font-black text-[#0F172A] tracking-tight mt-1 font-mono">
                            {stats.rejected}
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
                                    setPage(0);
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
                                setPage(0);
                            }}
                            className="appearance-none bg-white border border-[#E2E8F0] rounded-xl px-4 py-2 pr-9 text-xs font-semibold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#00DF89]/30 cursor-pointer shadow-sm"
                        >
                            <option value="">All classes ({detectionTypes.length})</option>
                            {detectionTypes.map((type) => (
                                <option key={type.detection_type} value={type.detection_type}>
                                    {formatDetectionTypeLabel(type.detection_type)} ({type.total.toLocaleString()})
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    {/* Time Dropdown with Calendar Icon */}
                    <div className="relative">
                        <div className="flex items-center gap-2 bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-xs font-semibold text-[#0F172A] shadow-sm">
                            <Calendar className="w-3.5 h-3.5 text-[#94A3B8]" />
                            <select
                                value={timeRange}
                                onChange={(e) => { setTimeRange(e.target.value); setPage(0); }}
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

            {/* Evidence Records Counter matching image */}
            <div className="flex items-center justify-between text-xs text-[#64748B] font-semibold px-1">
                <span>Showing {displaySubmissions.length > 0 ? displaySubmissions.length : total} active evidence records</span>
            </div>

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

                        return (
                            <div
                                key={sub.id}
                                onClick={() => setSelectedSubmission(sub)}
                                className="bg-white rounded-[22px] border border-[#E2E8F0] shadow-sm overflow-hidden hover:shadow-md transition-all duration-200 group flex flex-col cursor-pointer"
                            >
                                {/* Evidence Visual Preview with Badges matching image */}
                                <div className="relative aspect-[16/10] bg-[#0B1528] overflow-hidden">
                                    {/* ID Badge Top Left */}
                                    <div className="absolute top-3.5 left-3.5 z-10 bg-[#0B1528]/85 backdrop-blur-md text-white text-[11px] font-mono font-bold px-2.5 py-1 rounded-md shadow-sm">
                                        {caseId}
                                    </div>

                                    {/* Status Badge Top Right */}
                                    <div className="absolute top-3.5 right-3.5 z-10">
                                        {getStatusPill(sub.verification_status)}
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
                                            <span>Inspect Case</span>
                                        </div>
                                    </div>
                                </div>

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
                                            onClick={(e) => handleVerify(sub.id, e)}
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
                                            onClick={(e) => handleDismiss(sub.id, e)}
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

            {/* Pagination Controls */}
            {!isLoading && total > limit && (
                <div className="flex items-center justify-center gap-2 pt-6">
                    <button
                        disabled={page === 0}
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        className="p-2.5 rounded-xl bg-white border border-[#E2E8F0] text-[#0F172A] hover:border-[#00DF89] disabled:opacity-40 transition-all shadow-sm cursor-pointer"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-4 py-2 text-xs font-bold text-[#0F172A] bg-white border border-[#E2E8F0] rounded-xl shadow-sm">
                        Page {page + 1} of {Math.ceil(total / limit) || 1}
                    </span>
                    <button
                        disabled={(page + 1) * limit >= total}
                        onClick={() => setPage((p) => p + 1)}
                        className="p-2.5 rounded-xl bg-white border border-[#E2E8F0] text-[#0F172A] hover:border-[#00DF89] disabled:opacity-40 transition-all shadow-sm cursor-pointer"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Evidence Inspection Modal */}
            {selectedSubmission && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
                    onClick={() => setSelectedSubmission(null)}
                >
                    <div
                        className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 border border-[#E2E8F0] animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
                            <div>
                                <h3 className="text-xl font-bold text-[#0F172A]">
                                    Evidence Details #{selectedSubmission.id}
                                </h3>
                                <p className="text-xs text-[#64748B] mt-0.5">
                                    Captured by {selectedSubmission.username} ({selectedSubmission.country_code || "IN"})
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedSubmission(null)}
                                className="p-2 rounded-xl text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Media: playable clip for video cases, frame otherwise */}
                        <div className="rounded-2xl overflow-hidden aspect-[16/10] bg-slate-900 border border-[#E2E8F0] flex items-center justify-center">
                            {selectedSubmission.video_asset?.url ? (
                                <video
                                    src={selectedSubmission.video_asset.url}
                                    controls
                                    playsInline
                                    className="w-full h-full object-contain"
                                />
                            ) : selectedSubmission.images?.[0]?.image_url ? (
                                <img
                                    src={selectedSubmission.images[0].image_url}
                                    alt="Evidence frame"
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <div className="flex flex-col items-center gap-2 text-slate-400">
                                    <ImageOff className="w-8 h-8" />
                                    <span className="text-[11px] font-bold uppercase tracking-widest">No media attached</span>
                                </div>
                            )}
                        </div>

                        {/* Modal Telemetries */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-white p-4 rounded-2xl border border-[#E2E8F0]">
                            <div>
                                <p className="text-[10px] font-bold text-[#94A3B8] uppercase">Violation Type</p>
                                <p className="text-xs font-bold text-[#0F172A] capitalize mt-0.5">{selectedSubmission.detection_type}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-[#94A3B8] uppercase">Status</p>
                                <p className="text-xs font-bold text-[#0F172A] capitalize mt-0.5">{selectedSubmission.verification_status}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-[#94A3B8] uppercase">Beats Earned</p>
                                <p className="text-xs font-bold text-[#0F172A] mt-0.5 font-mono">{selectedSubmission.beats_earned} PTS</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-[#94A3B8] uppercase">Latitude</p>
                                <p className="text-xs font-bold text-[#0F172A] mt-0.5 font-mono">{selectedSubmission.latitude || "19.1225"}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-[#94A3B8] uppercase">Longitude</p>
                                <p className="text-xs font-bold text-[#0F172A] mt-0.5 font-mono">{selectedSubmission.longitude || "72.9294"}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-[#94A3B8] uppercase">Timestamp</p>
                                <p className="text-xs font-bold text-[#0F172A] mt-0.5 font-mono">{new Date(selectedSubmission.created_at).toLocaleTimeString()}</p>
                            </div>
                        </div>

                        {/* Modal Action Buttons */}
                        <div className="flex items-center gap-3 pt-2">
                            <button
                                onClick={() => handleVerify(selectedSubmission.id)}
                                className="flex-1 py-3 bg-[#00DF89] hover:bg-[#00DF89]/90 text-slate-950 font-bold text-xs rounded-xl shadow-md shadow-[#00DF89]/20 flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <Check className="w-4 h-4 stroke-[2.5]" />
                                Validate Case
                            </button>
                            <button
                                onClick={() => handleDismiss(selectedSubmission.id)}
                                className="py-3 px-5 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#475569] font-bold text-xs rounded-xl transition-all cursor-pointer"
                            >
                                Dismiss Case
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
