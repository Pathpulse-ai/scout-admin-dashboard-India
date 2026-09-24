"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
    Clock,
    MapPin,
    Users as UsersIcon,
    Globe,
    RefreshCw,
    TrendingUp,
    ArrowRight,
    Map as MapIcon,
    Loader2
} from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import PageHeader from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils";

interface CountryStat {
    rank: number;
    code: string;
    submissions: number;
    activityPercent: number;
}

interface ScoutAnalyticsData {
    country: string;
    total_india_submissions: number;
    states_data: {
        state: string;
        total_scouts: number;
        total_submissions: number;
        total_beats: number;
        verified_rate: number;
        detection_types: Record<string, number>;
    }[];
}

interface StatsData {
    total_submissions: number;
    verified: number;
    rejected: number;
    pending: number;
    total_frames: number;
}

const FALLBACK_COUNTRIES: CountryStat[] = [
    { rank: 1, code: "NG", submissions: 2041367, activityPercent: 88 },
    { rank: 2, code: "ID", submissions: 476530, activityPercent: 32 },
    { rank: 3, code: "IN", submissions: 76385, activityPercent: 12 },
    { rank: 4, code: "none", submissions: 45909, activityPercent: 8 },
    { rank: 5, code: "PK", submissions: 37775, activityPercent: 6 },
    { rank: 6, code: "BD", submissions: 31356, activityPercent: 5 },
];

export default function AnalyticsPage() {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Live data
    const [totalHours, setTotalHours] = useState("87,296");
    const [totalKm, setTotalKm] = useState("1,208,628");
    const [globalUserbase, setGlobalUserbase] = useState("83,572");
    const [activeCountries, setActiveCountries] = useState("32");
    const [countriesData] = useState<CountryStat[]>(FALLBACK_COUNTRIES);

    // India-specific analytics
    const [indiaSubmissions, setIndiaSubmissions] = useState(0);
    const [indiaStates, setIndiaStates] = useState<ScoutAnalyticsData["states_data"]>([]);

    const fetchAnalytics = useCallback(async () => {
        try {
            // Fetch scout analytics (India-scoped)
            const analyticsRes = await fetch("/api/analytics/scout");
            if (analyticsRes.ok) {
                const analyticsData = await analyticsRes.json() as ScoutAnalyticsData;
                setIndiaSubmissions(analyticsData.total_india_submissions);
                setIndiaStates(analyticsData.states_data);
            }

            // Fetch global stats
            const statsRes = await fetch("/api/stats");
            if (statsRes.ok) {
                const statsData = await statsRes.json() as StatsData;
                setTotalHours(statsData.total_frames.toLocaleString());
                setTotalKm(statsData.total_submissions.toLocaleString());
                setGlobalUserbase(statsData.verified.toLocaleString());
                setActiveCountries(statsData.pending.toLocaleString());
            }
        } catch (err) {
            console.warn("Failed to fetch analytics, using defaults:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        fetchAnalytics().finally(() => {
            setTimeout(() => setIsRefreshing(false), 400);
        });
    };

    // Use India state data for geographic table if available, else fallback
    const displayData: CountryStat[] = indiaStates.length > 0
        ? indiaStates.map((st, idx) => {
            const maxSubs = indiaStates[0]?.total_submissions || 1;
            return {
                rank: idx + 1,
                code: st.state,
                submissions: st.total_submissions,
                activityPercent: Math.round((st.total_submissions / maxSubs) * 100),
            };
        })
        : countriesData;

    const tableTitle = indiaStates.length > 0 ? "India State-wise Reach" : "Geographic Reach";
    const tableSubtitle = indiaStates.length > 0 ? "SUBMISSIONS BY INDIAN STATE" : "SUBMISSIONS BY COUNTRY";

    return (
        <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500 pb-12 font-sans">
            {/* Header */}
            <PageHeader
                title="Dashboard"
                subtitle="SMART INFRASTRUCTURE & SCOUT INTELLIGENCE"
                actions={
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border-subtle text-xs font-bold text-muted-foreground hover:text-brand-blue hover:border-brand-blue/30 transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                        <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin text-brand-blue")} />
                        <span>Refresh Metrics</span>
                    </button>
                }
            />

            {isLoading ? (
                <div className="py-24 flex flex-col items-center justify-center gap-4 bg-card rounded-2xl border border-border-subtle">
                    <Loader2 className="w-8 h-8 text-brand-blue animate-spin" />
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Aggregating India intelligence data...</p>
                </div>
            ) : (
                <>
                    {/* High-Level Metrics Top 4 Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard
                            title="INDIA SUBMISSIONS"
                            value={indiaSubmissions > 0 ? indiaSubmissions.toLocaleString() : totalHours}
                            icon={Clock}
                            variant="info"
                        />
                        <StatCard
                            title="TOTAL FRAMES"
                            value={totalKm}
                            icon={MapPin}
                            variant="success"
                        />
                        <StatCard
                            title="VERIFIED"
                            value={globalUserbase}
                            icon={UsersIcon}
                            variant="default"
                        />
                        <StatCard
                            title="ACTIVE STATES"
                            value={indiaStates.length > 0 ? String(indiaStates.length) : activeCountries}
                            icon={Globe}
                            variant="warning"
                        />
                    </div>

                    {/* Main Content Grid: Geographic Reach + Right Stats */}
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                        {/* Geographic Reach Table (2 Cols) */}
                        <div className="xl:col-span-2 bg-card border border-border-subtle rounded-2xl overflow-hidden shadow-sm">
                            {/* Table Header */}
                            <div className="p-5 sm:p-6 border-b border-border-subtle flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-brand-blue/10 border border-brand-blue/20 flex items-center justify-center text-brand-blue shadow-sm">
                                        <MapIcon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-foreground tracking-tight text-base">
                                            {tableTitle}
                                        </h3>
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">
                                            {tableSubtitle}
                                        </p>
                                    </div>
                                </div>

                                <div className="px-3 py-1 bg-brand-blue/10 border border-brand-blue/25 rounded-full text-[10px] font-bold text-brand-blue uppercase tracking-widest">
                                    {indiaStates.length > 0 ? "LIVE DATA" : "CACHED DATA"}
                                </div>
                            </div>

                            {/* Table Body */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-muted-background/40 border-b border-border-subtle">
                                            <th className="px-6 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                                RANK
                                            </th>
                                            <th className="px-6 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                                {indiaStates.length > 0 ? "STATE" : "CODE"}
                                            </th>
                                            <th className="px-6 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">
                                                SUBMISSIONS
                                            </th>
                                            <th className="px-6 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">
                                                ACTIVITY
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border-subtle">
                                        {displayData.map((item) => (
                                            <tr
                                                key={item.code}
                                                className="hover:bg-muted-background/30 transition-colors group"
                                            >
                                                <td className="px-6 py-4">
                                                    <span className="text-xs font-bold text-muted-foreground group-hover:text-brand-blue transition-colors font-mono">
                                                        #{item.rank}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className={cn(
                                                        "rounded-xl bg-muted-background border border-border-subtle flex items-center justify-center text-xs font-bold text-foreground group-hover:border-brand-blue/40 group-hover:text-brand-blue transition-all",
                                                        indiaStates.length > 0 ? "px-3 py-1.5 w-auto inline-flex" : "w-12 h-8"
                                                    )}>
                                                        {item.code}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="text-sm font-bold text-foreground font-mono">
                                                        {item.submissions.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-3">
                                                        <div className="w-28 h-1.5 bg-muted-background rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-brand-blue rounded-full transition-all duration-700 shadow-[0_0_8px_rgba(2,195,148,0.4)]"
                                                                style={{ width: `${item.activityPercent}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-[10px] font-bold text-muted-foreground font-mono w-8 text-right">
                                                            {item.activityPercent}%
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Right Column: Network Expansion & Efficiency Stats */}
                        <div className="space-y-6">
                            {/* Network Expansion Box */}
                            <div className="bg-card border border-border-subtle rounded-2xl p-6 relative overflow-hidden shadow-sm group">
                                <div className="w-10 h-10 rounded-xl bg-brand-blue/10 border border-brand-blue/20 flex items-center justify-center text-brand-blue mb-4 shadow-sm">
                                    <TrendingUp className="w-5 h-5" />
                                </div>
                                <h4 className="text-lg font-bold text-foreground tracking-tight mb-2">
                                    India Network Expansion
                                </h4>
                                <p className="text-xs text-muted-foreground font-medium leading-relaxed mb-5">
                                    The PathPulse India network has coverage across{" "}
                                    <strong className="text-foreground font-bold">{indiaStates.length > 0 ? indiaStates.length : 32}</strong> {indiaStates.length > 0 ? "states & territories" : "regions"}, processing{" "}
                                    <strong className="text-foreground font-bold">{indiaSubmissions > 0 ? indiaSubmissions.toLocaleString() : "76,385"}</strong> detection submissions.
                                </p>
                                <div className="flex items-center gap-1.5 text-brand-blue text-[10px] font-bold uppercase tracking-widest group-hover:translate-x-1 transition-transform cursor-pointer">
                                    <span>VIEW COVERAGE DETAILS</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </div>
                            </div>

                            {/* Efficiency Stats Box */}
                            <div className="bg-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-6">
                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                    EFFICIENCY METRICS
                                </h4>

                                <div className="space-y-5">
                                    {/* Metric 1 */}
                                    <div className="flex justify-between items-end pb-4 border-b border-border-subtle/60">
                                        <div>
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                                                AVG. SUBMISSIONS / SCOUT
                                            </p>
                                            <p className="text-xl font-bold text-foreground tracking-tight font-mono">
                                                {indiaStates.length > 0
                                                    ? Math.round(indiaSubmissions / Math.max(1, indiaStates.reduce((acc, s) => acc + s.total_scouts, 0)))
                                                    : 14} <span className="text-xs font-normal text-muted-foreground font-sans">subs</span>
                                            </p>
                                        </div>
                                        <div className="text-brand-blue text-[10px] font-bold bg-brand-blue/10 px-2.5 py-0.5 rounded-full border border-brand-blue/20">
                                            HEALTHY
                                        </div>
                                    </div>

                                    {/* Metric 2 */}
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                                                TOTAL BEATS EARNED
                                            </p>
                                            <p className="text-xl font-bold text-foreground tracking-tight font-mono">
                                                {indiaStates.length > 0
                                                    ? indiaStates.reduce((acc, s) => acc + s.total_beats, 0).toFixed(1)
                                                    : "37,769.6"} <span className="text-xs font-normal text-muted-foreground font-sans">PTS</span>
                                            </p>
                                        </div>
                                        <div className="text-brand-blue text-[10px] font-bold bg-brand-blue/10 px-2.5 py-0.5 rounded-full border border-brand-blue/20">
                                            ACTIVE
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
