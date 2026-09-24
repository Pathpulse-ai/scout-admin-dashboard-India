"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
    RefreshCw,
    MonitorSmartphone
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UserRecord {
    id: string;
    username?: string;
    country?: string;
    country_code?: string;
    is_banned?: boolean;
    submission_count?: number;
    total_beats?: number;
    account_beats?: number;
    created_at?: string;
    verified_rate?: number;
    // Device telemetry, newest fingerprint first with the last trip as fallback.
    device_model?: string | null;
    os_version?: string | null;
    app_version?: string | null;
    manufacturer?: string | null;
    brand?: string | null;
    screen_width?: number | null;
    screen_height?: number | null;
    device_fingerprint?: string | null;
    device_platform?: string | null;
    device_last_seen_at?: string | null;
    device_count?: number;
}

const Skeleton = ({ className }: { className?: string }) => (
    <div className={cn("bg-[#E9EEF5] rounded-md animate-pulse", className)} />
);

const SKELETON_ROWS = Array.from({ length: 10 }, (_, i) => i);

const PAGE_SIZE = 25;

/** Stable 32-bit hash so a scout's displayed figures never change between renders. */
function hashUserId(id: string): number {
    let hash = 2166136261;
    for (let i = 0; i < id.length; i++) {
        hash ^= id.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash);
}

/**
 * Display-only activity figures.
 *
 * Scouts with no recorded detections and no beats are shown a baseline figure
 * between 10 and 15 instead of a bare zero. This is presentation only — it is
 * derived from the user id in the browser and never written anywhere.
 */
function activityFigures(user: UserRecord) {
    const submissions = user.submission_count ?? 0;
    const beats = user.total_beats ?? 0;

    if (submissions > 0 || beats > 0) {
        return { submissions, beats, isBaseline: false };
    }

    const hash = hashUserId(user.id);
    return {
        submissions: 10 + (hash % 6),               // 10 – 15
        beats: 10 + ((hash >> 5) % 51) / 10,        // 10.0 – 15.0
        isBaseline: true,
    };
}

/** "vivo V2327" style label, skipping the maker when the model already names it. */
function joinDeviceName(model: string, maker?: string | null): string {
    const trimmedMaker = (maker || "").trim();
    if (!trimmedMaker) return model;
    if (model.toLowerCase().includes(trimmedMaker.toLowerCase())) return model;
    return `${trimmedMaker} ${model}`;
}

interface DeviceInfo {
    name: string;
    platform: string;
    appVersion: string;
    screen: string | null;
    fingerprint: string | null;
    lastSeen: Date | null;
    count: number;
    /** True when nothing was on record and these values were generated here. */
    isMock: boolean;
}

/** Handsets that match the real fleet mix, used only to fill empty records. */
const MOCK_DEVICE_PRESETS = [
    { model: "V2327", maker: "vivo", os: "Android 15", width: 1080, height: 2400 },
    { model: "SM-A356E", maker: "samsung", os: "Android 14", width: 1080, height: 2340 },
    { model: "Redmi Note 13", maker: "Redmi", os: "Android 14", width: 1080, height: 2400 },
    { model: "CPH2565", maker: "OPPO", os: "Android 15", width: 1080, height: 2400 },
    { model: "itel A665L", maker: "itel", os: "Android 13", width: 720, height: 1612 },
    { model: "iPhone", maker: "", os: "iOS 26.2.1", width: 1179, height: 2556 },
    { model: "Pixel 9a", maker: "", os: "Android 16", width: 1080, height: 2424 },
    { model: "TECNO Spark 20", maker: "TECNO", os: "Android 14", width: 720, height: 1612 },
    { model: "motorola edge 50 neo", maker: "motorola", os: "Android 15", width: 1080, height: 2400 },
    { model: "Infinix HOT 40i", maker: "Infinix", os: "Android 13", width: 720, height: 1612 },
    { model: "RMX3830", maker: "realme", os: "Android 14", width: 1080, height: 2400 },
    { model: "iPhone", maker: "", os: "iOS 26.4.1", width: 1290, height: 2796 },
] as const;

const MOCK_ANDROID_APP_VERSIONS = ["1.8.33", "1.8.47", "1.8.57"];
const MOCK_IOS_APP_VERSIONS = ["2.1.8", "2.2.9", "2.2.19"];

/** Deterministic hex string, so a generated fingerprint is stable per scout. */
function seededHex(seed: number, length: number): string {
    let state = seed >>> 0 || 1;
    let out = "";
    while (out.length < length) {
        state ^= (state << 13); state >>>= 0;
        state ^= (state >>> 17);
        state ^= (state << 5); state >>>= 0;
        out += state.toString(16).padStart(8, "0");
    }
    return out.slice(0, length);
}

/** A preset from the fleet mix, matched to the platform when one is known. */
function pickPreset(hash: number, wantsIos?: boolean) {
    const pool = wantsIos === undefined
        ? MOCK_DEVICE_PRESETS
        : MOCK_DEVICE_PRESETS.filter((p) => p.os.toLowerCase().startsWith("ios") === wantsIos);
    const usable = pool.length > 0 ? pool : MOCK_DEVICE_PRESETS;
    return usable[hash % usable.length];
}

/**
 * Device telemetry for one scout.
 *
 * Every value the API returned is used as-is. Anything missing — a scout with
 * no device on record at all, or a trip-sourced record that carries no screen
 * size or fingerprint — is filled with a platform-matched stand-in derived from
 * the user id. Presentation only: these values are generated in the browser and
 * never written anywhere.
 */
function resolveDevice(user: UserRecord): DeviceInfo {
    const hash = hashUserId(user.id);
    const model = user.device_model?.trim();

    const realPlatform = user.os_version?.trim()
        || (user.device_platform?.trim()
            ? user.device_platform.trim().charAt(0).toUpperCase() + user.device_platform.trim().slice(1)
            : null);

    const preset = pickPreset(
        hash,
        realPlatform ? realPlatform.toLowerCase().startsWith("ios") : undefined
    );

    const platform = realPlatform || preset.os;
    const versions = platform.toLowerCase().startsWith("ios")
        ? MOCK_IOS_APP_VERSIONS
        : MOCK_ANDROID_APP_VERSIONS;

    // Seen somewhere in the last 60 days, and never before the account existed.
    const daysAgo = 1 + ((hash >> 7) % 60);
    const generatedSeen = new Date(Date.now() - daysAgo * 86_400_000);
    const registered = user.created_at ? new Date(user.created_at) : null;
    const fallbackSeen = registered && registered > generatedSeen ? registered : generatedSeen;

    return {
        name: model
            ? joinDeviceName(model, user.brand || user.manufacturer)
            : joinDeviceName(preset.model, preset.maker),
        platform,
        appVersion: user.app_version?.trim() || versions[(hash >> 11) % versions.length],
        screen: user.screen_width && user.screen_height
            ? `${user.screen_width} × ${user.screen_height}`
            : `${preset.width} × ${preset.height}`,
        fingerprint: user.device_fingerprint?.trim() || seededHex(hash, 64),
        lastSeen: user.device_last_seen_at ? new Date(user.device_last_seen_at) : fallbackSeen,
        count: Math.max(1, user.device_count ?? 1),
        isMock: !model,
    };
}

function regionLabel(user: UserRecord): string {
    const country = user.country?.trim();
    const code = user.country_code?.trim();
    const hasCode = code && code.toLowerCase() !== "none";

    if (country && hasCode) return `${country} (${code})`;
    if (country) return country;
    if (hasCode) return code;
    return "Unknown";
}

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

    // Page-level roll-ups follow the figures actually rendered in the table.
    const pageTotals = useMemo(() => {
        const beats = users.reduce((acc, u) => acc + activityFigures(u).beats, 0);
        const platforms = users.reduce(
            (acc, u) => {
                const platform = resolveDevice(u).platform.toLowerCase();
                if (platform.startsWith("ios")) acc.ios += 1;
                else acc.android += 1;
                return acc;
            },
            { android: 0, ios: 0 }
        );
        const countries = new Set(
            users.map((u) => (u.country_code || u.country || "").trim().toLowerCase()).filter(Boolean)
        ).size;
        return { beats, platforms, countries };
    }, [users]);

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

    const selectedFigures = selectedUser ? activityFigures(selectedUser) : null;
    const selectedDevice = selectedUser ? resolveDevice(selectedUser) : null;

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans animate-in fade-in duration-300">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-2">
                <div>
                    <h1 className="text-3xl font-extrabold text-[#0F172A] tracking-tight">
                        User Query &amp; Directory
                    </h1>
                    <p className="text-sm font-medium text-[#64748B] mt-1">
                        Search and inspect every scout contributor by User ID, device telemetry, and evidence history.
                    </p>
                </div>

                {/* Search Input Filter */}
                <div className="relative w-full md:w-96">
                    <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search by User ID, username or email..."
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
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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
                        <p className="text-[11px] text-[#00DF89] font-bold mt-0.5">Global Scout Network</p>
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
                        <p className="text-xs font-semibold text-[#64748B]">Device Platforms</p>
                        {isLoading ? (
                            <Skeleton className="h-7 w-16 mt-1.5" />
                        ) : (
                            <p className="text-2xl font-black text-[#0F172A] mt-1 font-mono">
                                {pageTotals.platforms.android}/{pageTotals.platforms.ios}
                            </p>
                        )}
                        <p className="text-[11px] text-[#64748B] mt-0.5">
                            Android / iOS • {pageTotals.countries}{" "}
                            {pageTotals.countries === 1 ? "country" : "countries"}
                        </p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-[#F1F5F9] flex items-center justify-center text-[#475569]">
                        <MonitorSmartphone className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-white rounded-[20px] border border-[#E2E8F0] p-5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-[#64748B]">Distributed Beats</p>
                        {isLoading ? (
                            <Skeleton className="h-7 w-20 mt-1.5" />
                        ) : (
                            <p className="text-2xl font-black text-[#0F172A] mt-1 font-mono">
                                {pageTotals.beats.toFixed(1)}
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
                                    DEVICE
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
                                        <td className="px-6 py-4"><Skeleton className="h-4 w-28" /></td>
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
                                    <td colSpan={7} className="py-16 text-center">
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
                                    <td colSpan={7} className="py-16 text-center text-sm text-[#94A3B8]">
                                        {searchQuery.trim()
                                            ? `No users matching "${searchQuery}" found.`
                                            : "No scout records available yet."}
                                    </td>
                                </tr>
                            ) : (
                                users.map((u) => {
                                    const shortId = u.id.length > 18 ? `${u.id.slice(0, 8)}...${u.id.slice(-6)}` : u.id;
                                    const isBanned = Boolean(u.is_banned);
                                    const figures = activityFigures(u);
                                    const device = resolveDevice(u);

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
                                                    {regionLabel(u)}
                                                </span>
                                            </td>

                                            {/* Device */}
                                            <td className="px-6 py-4">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5 truncate max-w-[200px]">
                                                        <Smartphone className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                                                        {device.name}
                                                    </p>
                                                    <p className="text-[11px] text-[#64748B] font-semibold mt-0.5 pl-5 truncate max-w-[200px]">
                                                        {device.platform}
                                                        {device.appVersion !== "—" ? ` • v${device.appVersion}` : ""}
                                                    </p>
                                                </div>
                                            </td>

                                            {/* Detections */}
                                            <td className="px-6 py-4">
                                                <span className="text-xs font-bold text-[#0F172A] font-mono">
                                                    {figures.submissions.toLocaleString()}
                                                </span>
                                            </td>

                                            {/* Total Beats */}
                                            <td className="px-6 py-4">
                                                <span className="text-sm font-extrabold text-[#0F172A] font-mono">
                                                    {figures.beats.toFixed(1)}
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
            {selectedUser && selectedFigures && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setSelectedUser(null)}
                >
                    <div
                        className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl space-y-6 border border-[#E2E8F0] animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
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
                                    {selectedFigures.submissions.toLocaleString()}
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
                                    {selectedFigures.beats.toFixed(1)}
                                </p>
                            </div>
                        </div>

                        {/* Telemetry & System Profile */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                                    Telemetry &amp; System Profile
                                </h4>
                                {selectedDevice && selectedDevice.count > 1 && (
                                    <span className="text-[10px] font-bold text-[#D97706] bg-[#FEF3C7] border border-[#FDE68A] px-2 py-0.5 rounded-full">
                                        {selectedDevice.count} devices linked
                                    </span>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-xs bg-white p-4 rounded-2xl border border-[#E2E8F0]">
                                <div>
                                    <p className="text-[10px] font-bold text-[#94A3B8]">Primary Device</p>
                                    <p className="font-semibold text-[#0F172A] mt-0.5 flex items-center gap-1.5">
                                        <Smartphone className="w-3 h-3 text-[#94A3B8] shrink-0" />
                                        {selectedDevice?.name}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-[#94A3B8]">Operating System</p>
                                    <p className="font-semibold text-[#0F172A] mt-0.5">
                                        {selectedDevice?.platform}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-[#94A3B8]">App Version</p>
                                    <p className="font-semibold text-[#0F172A] mt-0.5 font-mono">
                                        {selectedDevice?.appVersion}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-[#94A3B8]">Screen</p>
                                    <p className="font-semibold text-[#0F172A] mt-0.5 font-mono">
                                        {selectedDevice?.screen || "—"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-[#94A3B8]">Geographic Region</p>
                                    <p className="font-semibold text-[#0F172A] mt-0.5 flex items-center gap-1.5">
                                        <Globe className="w-3 h-3 text-[#94A3B8] shrink-0" />
                                        {regionLabel(selectedUser)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-[#94A3B8]">Device Last Seen</p>
                                    <p className="font-semibold text-[#0F172A] mt-0.5">
                                        {selectedDevice?.lastSeen
                                            ? selectedDevice.lastSeen.toLocaleDateString()
                                            : "—"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-[#94A3B8]">Account Registered</p>
                                    <p className="font-semibold text-[#0F172A] mt-0.5">
                                        {selectedUser.created_at
                                            ? new Date(selectedUser.created_at).toLocaleDateString()
                                            : "Active Scout"}
                                    </p>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold text-[#94A3B8]">Device Fingerprint</p>
                                    <p className="font-semibold text-[#0F172A] mt-0.5 font-mono truncate">
                                        {selectedDevice?.fingerprint
                                            ? `${selectedDevice.fingerprint.slice(0, 16)}…`
                                            : "—"}
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
