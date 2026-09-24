"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
    Search,
    Smartphone,
    Fingerprint,
    CheckCircle2,
    X,
    Globe,
    Award,
    Copy,
    Check,
    ChevronRight,
    ChevronLeft,
    Users,
    Loader2,
    RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UserRecord {
    id: string;
    country?: string;
    country_code?: string;
    device?: string;
    os_version?: string;
    is_banned?: boolean;
    submission_count?: number;
    total_beats?: number;
    created_at?: string;
    verified_rate?: number;
}

const Skeleton = ({ className }: { className?: string }) => (
    <div className={cn("bg-[#E9EEF5] rounded-md animate-pulse", className)} />
);

const SKELETON_ROWS = Array.from({ length: 10 }, (_, i) => i);

const PAGE_SIZE = 25;

/** Windowed page numbers, e.g. [1, "gap", 7, 8, 9, "gap", 42]. */
function buildPageWindow(current: number, totalPages: number): (number | "gap")[] {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages = new Set<number>([1, totalPages, current]);
    if (current - 1 > 1) pages.add(current - 1);
    if (current + 1 < totalPages) pages.add(current + 1);
    if (current <= 3) pages.add(2).add(3).add(4);
    if (current >= totalPages - 2) pages.add(totalPages - 1).add(totalPages - 2).add(totalPages - 3);

    const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
    const out: (number | "gap")[] = [];
    sorted.forEach((page, i) => {
        if (i > 0 && page - sorted[i - 1] > 1) out.push("gap");
        out.push(page);
    });
    return out;
}

export default function UserQueryPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [modalCopied, setModalCopied] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const rangeEnd = Math.min(page * PAGE_SIZE, total);

    // Fetch one page of users from the API
    const fetchUsers = useCallback(async (query: string, pageNumber: number) => {
        setIsLoading(true);
        setLoadError(null);
        try {
            const params = new URLSearchParams({
                limit: String(PAGE_SIZE),
                offset: String((pageNumber - 1) * PAGE_SIZE),
            });
            if (query.trim()) params.set("q", query.trim());

            const res = await fetch(`/api/users?${params.toString()}`);
            if (!res.ok) {
                throw new Error(`Request failed with status ${res.status}`);
            }
            const data = await res.json() as { users?: UserRecord[]; total?: number };
            setUsers(data.users ?? []);
            setTotal(data.total ?? 0);
        } catch {
            setUsers([]);
            setTotal(0);
            setLoadError("Unable to load scout records. Check the connection and retry.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchUsers(searchQuery, page);
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [searchQuery, page, fetchUsers]);

    const goToPage = (next: number) => {
        const clamped = Math.min(Math.max(next, 1), totalPages);
        if (clamped === page) return;
        setPage(clamped);
        document.getElementById("main-content")?.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        setPage(1);
    };

    const handleCopy = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(id);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 1500);
    };

    const handleModalCopy = (id: string) => {
        navigator.clipboard.writeText(id);
        setModalCopied(true);
        setTimeout(() => setModalCopied(false), 1500);
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans animate-in fade-in duration-300">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-2">
                <div>
                    <h1 className="text-3xl font-extrabold text-[#0F172A] tracking-tight">
                        User Query & Directory
                    </h1>
                    <p className="text-sm font-medium text-[#64748B] mt-1">
                        Search and inspect scout contributors by User ID, telemetry, and evidence history.
                    </p>
                </div>

                {/* Search Input Filter */}
                <div className="relative w-full md:w-96">
                    <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search by User ID (UUID)..."
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="w-full bg-white border border-[#E2E8F0] rounded-2xl pl-10 pr-10 py-2.5 text-sm font-medium text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#00DF89]/30 focus:border-[#00DF89] shadow-sm transition-all"
                    />
                    {isLoading && (
                        <Loader2 className="w-4 h-4 text-[#00DF89] animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
                    )}
                </div>
            </div>

            {/* Quick Metrics Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-[20px] border border-[#E2E8F0] p-5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-[#64748B]">Total Scouts Queried</p>
                        {isLoading ? (
                            <Skeleton className="h-7 w-16 mt-1.5" />
                        ) : (
                            <p className="text-2xl font-black text-[#0F172A] mt-1 font-mono">
                                {total.toLocaleString()}
                            </p>
                        )}
                        <p className="text-[11px] text-[#00DF89] font-bold mt-0.5">India Scoped Network</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-[#E6FAF2] flex items-center justify-center text-[#00DF89]">
                        <Users className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-white rounded-[20px] border border-[#E2E8F0] p-5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-[#64748B]">Active Status Ratio</p>
                        {isLoading ? (
                            <Skeleton className="h-7 w-16 mt-1.5" />
                        ) : (
                            <p className="text-2xl font-black text-[#0F172A] mt-1 font-mono">
                                {Math.round(((users.filter(u => !u.is_banned).length) / Math.max(1, users.length)) * 100)}%
                            </p>
                        )}
                        <p className="text-[11px] text-[#64748B] mt-0.5">Active on this page</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-[#EFF6FF] flex items-center justify-center text-[#2563EB]">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-white rounded-[20px] border border-[#E2E8F0] p-5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-[#64748B]">Distributed Beats</p>
                        {isLoading ? (
                            <Skeleton className="h-7 w-20 mt-1.5" />
                        ) : (
                            <p className="text-2xl font-black text-[#0F172A] mt-1 font-mono">
                                {users.reduce((acc, u) => acc + (u.total_beats || 0), 0).toFixed(1)}
                            </p>
                        )}
                        <p className="text-[11px] text-[#64748B] mt-0.5">Earned on this page</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-[#FEF3C7] flex items-center justify-center text-[#D97706]">
                        <Award className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* Instruction Tip */}
            <div className="flex items-center justify-between text-xs text-[#64748B] font-semibold px-1">
                <span>
                    {isLoading
                        ? "Loading scout records..."
                        : total === 0
                            ? "No scout records to show"
                            : `Showing ${rangeStart.toLocaleString()}–${rangeEnd.toLocaleString()} of ${total.toLocaleString()} scouts • Click any row to view full profile details`}
                </span>
                <button
                    onClick={() => fetchUsers(searchQuery, page)}
                    className="flex items-center gap-1.5 text-xs text-[#00DF89] hover:underline cursor-pointer"
                >
                    <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
                    <span>Refresh</span>
                </button>
            </div>

            {/* User List Table by User ID */}
            <div className="bg-white rounded-[22px] border border-[#E2E8F0] shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                            <tr>
                                <th className="px-6 py-4 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                                    USER ID (UUID)
                                </th>
                                <th className="px-6 py-4 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                                    REGION
                                </th>
                                <th className="px-6 py-4 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                                    DETECTIONS
                                </th>
                                <th className="px-6 py-4 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                                    TOTAL BEATS
                                </th>
                                <th className="px-6 py-4 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                                    STATUS
                                </th>
                                <th className="px-6 py-4 text-[10px] font-bold text-[#64748B] uppercase tracking-wider text-right">
                                    ACTION
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F1F5F9]">
                            {isLoading ? (
                                SKELETON_ROWS.map((row) => (
                                    <tr key={`skeleton-${row}`}>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <Skeleton className="h-6 w-36 rounded-lg" />
                                                <Skeleton className="h-4 w-4" />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
                                        <td className="px-6 py-4"><Skeleton className="h-4 w-12" /></td>
                                        <td className="px-6 py-4"><Skeleton className="h-4 w-16" /></td>
                                        <td className="px-6 py-4"><Skeleton className="h-6 w-16 rounded-full" /></td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-end"><Skeleton className="h-4 w-16" /></div>
                                        </td>
                                    </tr>
                                ))
                            ) : loadError ? (
                                <tr>
                                    <td colSpan={6} className="py-16 text-center">
                                        <p className="text-sm font-semibold text-[#DC2626]">{loadError}</p>
                                        <button
                                            onClick={() => fetchUsers(searchQuery, page)}
                                            className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#00DF89] hover:underline cursor-pointer"
                                        >
                                            <RefreshCw className="w-3.5 h-3.5" />
                                            <span>Try again</span>
                                        </button>
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-16 text-center text-sm text-[#94A3B8]">
                                        {searchQuery.trim()
                                            ? `No users matching "${searchQuery}" found.`
                                            : "No scout records available yet."}
                                    </td>
                                </tr>
                            ) : (
                                users.map((u) => {
                                    const shortId = u.id.length > 18 ? `${u.id.slice(0, 8)}...${u.id.slice(-6)}` : u.id;
                                    const isBanned = Boolean(u.is_banned);

                                    return (
                                        <tr
                                            key={u.id}
                                            onClick={() => setSelectedUser(u)}
                                            className="hover:bg-[#F8FAFC] transition-colors cursor-pointer group"
                                        >
                                            {/* User ID with Monospace Pill and Copy Icon */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="bg-[#F1F5F9] text-[#0F172A] border border-[#E2E8F0] px-2.5 py-1 rounded-lg text-xs font-mono font-bold group-hover:border-[#00DF89]/40 transition-colors">
                                                        {shortId}
                                                    </span>
                                                    <button
                                                        onClick={(e) => handleCopy(u.id, e)}
                                                        className="p-1 rounded hover:bg-[#E2E8F0] text-[#94A3B8] hover:text-[#0F172A] transition-colors cursor-pointer"
                                                        title="Copy full User ID"
                                                    >
                                                        {copiedId === u.id ? (
                                                            <Check className="w-3.5 h-3.5 text-[#00DF89]" />
                                                        ) : (
                                                            <Copy className="w-3.5 h-3.5" />
                                                        )}
                                                    </button>
                                                </div>
                                            </td>

                                            {/* Region */}
                                            <td className="px-6 py-4">
                                                <span className="text-xs font-semibold text-[#0F172A] flex items-center gap-1.5">
                                                    <Globe className="w-3.5 h-3.5 text-[#94A3B8]" />
                                                    {u.country || "India"} ({u.country_code || "IN"})
                                                </span>
                                            </td>

                                            {/* Detections */}
                                            <td className="px-6 py-4">
                                                <span className="text-xs font-bold text-[#0F172A] font-mono">
                                                    {(u.submission_count ?? 0).toLocaleString()}
                                                </span>
                                            </td>

                                            {/* Total Beats */}
                                            <td className="px-6 py-4">
                                                <span className="text-sm font-extrabold text-[#0F172A] font-mono">
                                                    {(u.total_beats ?? 0).toFixed(1)}
                                                </span>
                                                <span className="text-[10px] text-[#94A3B8] ml-1 font-bold">PTS</span>
                                            </td>

                                            {/* Status */}
                                            <td className="px-6 py-4">
                                                {isBanned ? (
                                                    <span className="bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA] text-[11px] font-bold px-3 py-1 rounded-full">
                                                        Banned
                                                    </span>
                                                ) : (
                                                    <span className="bg-[#D1FAE5] text-[#065F46] border border-[#A7F3D0] text-[11px] font-bold px-3 py-1 rounded-full">
                                                        Active
                                                    </span>
                                                )}
                                            </td>

                                            {/* Action */}
                                            <td className="px-6 py-4 text-right">
                                                <div className="inline-flex items-center gap-1 text-xs font-bold text-[#00DF89] group-hover:translate-x-1 transition-transform">
                                                    <span>Inspect</span>
                                                    <ChevronRight className="w-4 h-4" />
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {!loadError && totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#E2E8F0] px-5 py-4">
                        <p className="text-xs font-semibold text-[#64748B]">
                            Page {page.toLocaleString()} of {totalPages.toLocaleString()}
                        </p>

                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => goToPage(page - 1)}
                                disabled={page === 1 || isLoading}
                                className="flex items-center gap-1 h-9 px-3 rounded-lg border border-[#E2E8F0] text-xs font-bold text-[#475569] hover:border-[#00DF89] hover:text-[#0F172A] disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                <span className="hidden sm:inline">Previous</span>
                            </button>

                            {buildPageWindow(page, totalPages).map((entry, i) =>
                                entry === "gap" ? (
                                    <span key={`gap-${i}`} className="w-9 h-9 flex items-center justify-center text-xs text-[#94A3B8]">
                                        &hellip;
                                    </span>
                                ) : (
                                    <button
                                        key={entry}
                                        onClick={() => goToPage(entry)}
                                        disabled={isLoading}
                                        aria-current={entry === page ? "page" : undefined}
                                        className={cn(
                                            "w-9 h-9 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:pointer-events-none",
                                            entry === page
                                                ? "bg-[#00DF89] text-slate-950"
                                                : "border border-[#E2E8F0] text-[#475569] hover:border-[#00DF89] hover:text-[#0F172A]"
                                        )}
                                    >
                                        {entry}
                                    </button>
                                )
                            )}

                            <button
                                onClick={() => goToPage(page + 1)}
                                disabled={page === totalPages || isLoading}
                                className="flex items-center gap-1 h-9 px-3 rounded-lg border border-[#E2E8F0] text-xs font-bold text-[#475569] hover:border-[#00DF89] hover:text-[#0F172A] disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                            >
                                <span className="hidden sm:inline">Next</span>
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* User Details Popup Modal */}
            {selectedUser && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setSelectedUser(null)}
                >
                    <div
                        className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl space-y-6 border border-[#E2E8F0] animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-[#E6FAF2] text-[#00DF89] border border-[#A7F3D0] flex items-center justify-center shadow-sm shrink-0">
                                    <Fingerprint className="w-6 h-6" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-xl font-extrabold text-[#0F172A]">
                                            Scout Record
                                        </h3>
                                        {selectedUser.is_banned ? (
                                            <span className="bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA] text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                Banned
                                            </span>
                                        ) : (
                                            <span className="bg-[#D1FAE5] text-[#065F46] border border-[#A7F3D0] text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                Active Scout
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs font-mono text-[#64748B] truncate mt-0.5">
                                        {selectedUser.id.slice(0, 8)}...{selectedUser.id.slice(-6)}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => setSelectedUser(null)}
                                className="p-2 rounded-xl text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
                                aria-label="Close modal"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Full User ID UUID Banner with 1-Click Copy */}
                        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 flex items-center justify-between">
                            <div className="min-w-0 flex-1 mr-3">
                                <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">
                                    USER ID (UUID)
                                </p>
                                <p className="text-xs font-mono font-bold text-[#0F172A] truncate mt-0.5 select-all">
                                    {selectedUser.id}
                                </p>
                            </div>
                            <button
                                onClick={() => handleModalCopy(selectedUser.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#E2E8F0] hover:border-[#00DF89] text-xs font-bold text-[#0F172A] shadow-sm transition-all cursor-pointer shrink-0"
                            >
                                {modalCopied ? (
                                    <>
                                        <Check className="w-3.5 h-3.5 text-[#00DF89]" />
                                        <span className="text-[#00DF89]">Copied</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-3.5 h-3.5 text-[#64748B]" />
                                        <span>Copy ID</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Performance Stats Grid */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0]">
                                <p className="text-[10px] font-bold text-[#94A3B8] uppercase">Submissions</p>
                                <p className="text-lg font-black text-[#0F172A] mt-0.5 font-mono">
                                    {(selectedUser.submission_count ?? 0).toLocaleString()}
                                </p>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0]">
                                <p className="text-[10px] font-bold text-[#94A3B8] uppercase">Verified Rate</p>
                                <p className="text-lg font-black text-[#00DF89] mt-0.5 font-mono">
                                    {selectedUser.verified_rate || 96.5}%
                                </p>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0]">
                                <p className="text-[10px] font-bold text-[#94A3B8] uppercase">Beats Earned</p>
                                <p className="text-lg font-black text-[#0F172A] mt-0.5 font-mono">
                                    {(selectedUser.total_beats ?? 0).toFixed(1)}
                                </p>
                            </div>
                        </div>

                        {/* Telemetry & System Profile */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                                Telemetry &amp; System Profile
                            </h4>
                            <div className="grid grid-cols-2 gap-3 text-xs bg-white p-4 rounded-2xl border border-[#E2E8F0]">
                                <div>
                                    <p className="text-[10px] font-bold text-[#94A3B8]">Primary Device</p>
                                    <p className="font-semibold text-[#0F172A] mt-0.5 flex items-center gap-1.5">
                                        <Smartphone className="w-3 h-3 text-[#94A3B8]" />
                                        {selectedUser.device || "Android Mobile Client"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-[#94A3B8]">Operating System</p>
                                    <p className="font-semibold text-[#0F172A] mt-0.5">
                                        {selectedUser.os_version || "Android 14 (PathPulse APK)"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-[#94A3B8]">Geographic Region</p>
                                    <p className="font-semibold text-[#0F172A] mt-0.5 flex items-center gap-1.5">
                                        <Globe className="w-3 h-3 text-[#94A3B8]" />
                                        {selectedUser.country || "India"} ({selectedUser.country_code || "IN"})
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-[#94A3B8]">Account Registered</p>
                                    <p className="font-semibold text-[#0F172A] mt-0.5">
                                        {selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString() : "Active Scout"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Modal Action Button */}
                        <div className="pt-2">
                            <button
                                onClick={() => setSelectedUser(null)}
                                className="w-full py-3 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#475569] font-bold text-xs rounded-xl transition-all cursor-pointer"
                            >
                                Close
                            </button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}
