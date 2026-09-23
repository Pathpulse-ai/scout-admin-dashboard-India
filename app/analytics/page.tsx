"use client";

import React, { useState } from "react";
import {
    Clock,
    MapPin,
    Users as UsersIcon,
    Globe,
    RefreshCw,
    TrendingUp,
    ArrowRight,
    Map as MapIcon
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

const COUNTRIES_DATA: CountryStat[] = [
    { rank: 1, code: "NG", submissions: 2041367, activityPercent: 88 },
    { rank: 2, code: "ID", submissions: 476530, activityPercent: 32 },
    { rank: 3, code: "IN", submissions: 76385, activityPercent: 12 },
    { rank: 4, code: "none", submissions: 45909, activityPercent: 8 },
    { rank: 5, code: "PK", submissions: 37775, activityPercent: 6 },
    { rank: 6, code: "BD", submissions: 31356, activityPercent: 5 },
];

export default function AnalyticsPage() {
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = () => {
        setIsRefreshing(true);
        setTimeout(() => {
            setIsRefreshing(false);
        }, 600);
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500 pb-12">
            {/* Header */}
            <PageHeader
                title="Scout Analytics"
                subtitle="GLOBAL REACH & PERFORMANCE METRICS"
                actions={
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#121e31]/80 border border-slate-800 text-xs font-bold text-slate-300 hover:text-[#02C394] hover:border-[#02C394]/40 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                    >
                        <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
                        Refresh Data
                    </button>
                }
            />

            {/* High-Level Metrics Top 4 Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="TOTAL HOURS COVERED"
                    value="87,296"
                    icon={Clock}
                    variant="info"
                />
                <StatCard
                    title="TOTAL KM COVERED"
                    value="1,208,628"
                    icon={MapPin}
                    variant="success"
                />
                <StatCard
                    title="GLOBAL USERBASE"
                    value="83,572"
                    icon={UsersIcon}
                    variant="default"
                />
                <StatCard
                    title="ACTIVE COUNTRIES"
                    value="32"
                    icon={Globe}
                    variant="warning"
                />
            </div>

            {/* Main Content Grid: Geographic Reach + Right Stats */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Geographic Reach Table (2 Cols) */}
                <div className="xl:col-span-2 bg-[#121e31]/80 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-md shadow-sm">
                    {/* Table Header */}
                    <div className="p-6 border-b border-slate-800/80 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#02C394]/15 flex items-center justify-center text-[#02C394]">
                                <MapIcon className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-extrabold text-white tracking-tight text-base">
                                    Geographic Reach
                                </h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                    SUBMISSIONS BY COUNTRY
                                </p>
                            </div>
                        </div>

                        <div className="px-3 py-1 bg-[#02C394]/10 border border-[#02C394]/30 rounded-full text-[10px] font-black text-[#02C394] uppercase tracking-widest">
                            REAL-TIME DATA
                        </div>
                    </div>

                    {/* Table Body */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-900/40 border-b border-slate-800/60">
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                        RANK
                                    </th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                        CODE
                                    </th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">
                                        SUBMISSIONS
                                    </th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">
                                        ACTIVITY
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {COUNTRIES_DATA.map((country) => (
                                    <tr
                                        key={country.code}
                                        className="hover:bg-slate-800/30 transition-colors group"
                                    >
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-black text-slate-400 group-hover:text-[#02C394] transition-colors">
                                                #{country.rank}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="w-12 h-9 rounded-xl bg-[#0b1320] border border-slate-800 flex items-center justify-center text-xs font-black text-white group-hover:border-[#02C394] group-hover:text-[#02C394] transition-all">
                                                {country.code}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="text-sm font-black text-white font-mono">
                                                {country.submissions.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <div className="w-28 h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-[#02C394] rounded-full transition-all duration-700 shadow-[0_0_8px_rgba(2,195,148,0.5)]"
                                                        style={{ width: `${country.activityPercent}%` }}
                                                    />
                                                </div>
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
                    <div className="bg-[#0e222e]/60 border border-[#02C394]/25 rounded-2xl p-6 relative overflow-hidden group">
                        <div className="absolute -right-8 -top-8 w-32 h-32 bg-[#02C394]/10 rounded-full blur-3xl group-hover:bg-[#02C394]/20 transition-all duration-700" />
                        <TrendingUp className="w-7 h-7 text-[#02C394] mb-4" />
                        <h4 className="text-xl font-black text-white tracking-tight mb-2">
                            Network Expansion
                        </h4>
                        <p className="text-xs text-slate-400 font-medium leading-relaxed mb-5">
                            The PathPulse network has successfully established a presence in{" "}
                            <strong className="text-white font-bold">32</strong> countries, processing over{" "}
                            <strong className="text-white font-bold">1,208,628 km</strong> of visual intelligence.
                        </p>
                        <div className="flex items-center gap-1.5 text-[#02C394] text-[10px] font-black uppercase tracking-widest group-hover:translate-x-1 transition-transform cursor-pointer">
                            <span>VIEW COVERAGE MAP</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                    </div>

                    {/* Efficiency Stats Box */}
                    <div className="bg-[#121e31]/80 border border-slate-800/80 rounded-2xl p-6 shadow-sm space-y-6">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                            EFFICIENCY STATS
                        </h4>

                        <div className="space-y-5">
                            {/* Metric 1 */}
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                        AVG. COVERAGE / USER
                                    </p>
                                    <p className="text-xl font-black text-white tracking-tight">
                                        14 <span className="text-xs font-bold text-slate-400">KM</span>
                                    </p>
                                </div>
                                <div className="text-[#02C394] text-[10px] font-black bg-[#02C394]/15 px-2.5 py-0.5 rounded-full border border-[#02C394]/20">
                                    +12%
                                </div>
                            </div>

                            {/* Metric 2 */}
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                        COVERAGE DENSITY
                                    </p>
                                    <p className="text-xl font-black text-white tracking-tight font-mono">
                                        37769.6 <span className="text-xs font-bold text-slate-400 font-sans">KM/Region</span>
                                    </p>
                                </div>
                                <div className="text-[#02C394] text-[10px] font-black bg-[#02C394]/15 px-2.5 py-0.5 rounded-full border border-[#02C394]/20">
                                    OPTIMAL
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
