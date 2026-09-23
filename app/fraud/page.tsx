"use client";

import React, { useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import {
    ShieldAlert,
    Activity,
    Eye,
    Ban,
    TrendingUp,
    Smartphone,
    MapPin,
    Search,
    Unlock,
    Trash2,
    Fingerprint,
    Globe,
    ShieldX,
    RefreshCw,
    History,
    AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

type TabType = "alerts" | "investigate" | "sanctioned" | "high-risk";

interface IncidentItem {
    id: string;
    userId: string;
    username: string;
    country: string;
    eventType: string;
    deviceModel: string;
    distance: string;
    time: string;
    date: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM";
}

interface BlockedUser {
    id: string;
    username: string;
    email: string;
    date: string;
    reason: string;
    beats: number;
}

interface HighRiskUser {
    id: string;
    username: string;
    country: string;
    riskScore: number;
    alerts30d: number;
    failedTrips: number;
    lastActivity: string;
}

interface HardwareBan {
    id: string;
    androidId: string;
    fingerprint: string;
    date: string;
    reason: string;
}

const INITIAL_INCIDENTS: IncidentItem[] = [
    {
        id: "inc-1",
        userId: "u-huzaif",
        username: "huzaif",
        country: "NG",
        eventType: "trip gps country mismatch",
        deviceModel: "Unknown Device",
        distance: "N/Akm",
        time: "1:38:46 PM",
        date: "9/23/2026",
        severity: "CRITICAL"
    },
    {
        id: "inc-2",
        userId: "u-makgrics",
        username: "makgrics",
        country: "NG",
        eventType: "trip validation",
        deviceModel: "Infinix X6728B",
        distance: "2.54km",
        time: "1:09:37 PM",
        date: "9/23/2026",
        severity: "HIGH"
    },
    {
        id: "inc-3",
        userId: "u-gembul",
        username: "Gembul",
        country: "ID",
        eventType: "trip validation",
        deviceModel: "V2520",
        distance: "0.34km",
        time: "1:00:52 PM",
        date: "9/23/2026",
        severity: "HIGH"
    },
    {
        id: "inc-4",
        userId: "u-muktar",
        username: "muktar",
        country: "IN",
        eventType: "trip gps country mismatch",
        deviceModel: "Unknown Device",
        distance: "N/Akm",
        time: "12:33:50 PM",
        date: "9/23/2026",
        severity: "CRITICAL"
    },
    {
        id: "inc-5",
        userId: "u-muktar",
        username: "muktar",
        country: "IN",
        eventType: "trip gps country mismatch",
        deviceModel: "Unknown Device",
        distance: "N/Akm",
        time: "12:13:33 PM",
        date: "9/23/2026",
        severity: "CRITICAL"
    },
    {
        id: "inc-6",
        userId: "u-muktar",
        username: "muktar",
        country: "IN",
        eventType: "trip validation",
        deviceModel: "TECNO KL4",
        distance: "3.39km",
        time: "12:13:26 PM",
        date: "9/23/2026",
        severity: "HIGH"
    },
    {
        id: "inc-7",
        userId: "u-gembul",
        username: "Gembul",
        country: "ID",
        eventType: "trip validation",
        deviceModel: "V2520",
        distance: "2.47km",
        time: "12:02:36 PM",
        date: "9/23/2026",
        severity: "HIGH"
    },
    {
        id: "inc-8",
        userId: "u-muktar",
        username: "muktar",
        country: "IN",
        eventType: "trip gps country mismatch",
        deviceModel: "Unknown Device",
        distance: "N/Akm",
        time: "11:59:24 AM",
        date: "9/23/2026",
        severity: "CRITICAL"
    }
];

const INITIAL_BLOCKED_USERS: BlockedUser[] = [
    { id: "b-1", username: "Mtk", email: "temilash2@gmail.com", date: "4/8/2026", reason: "Suspicious account activity from admin dashboard", beats: 0.00 },
    { id: "b-2", username: "mammann", email: "koria121212@gmail.com", date: "4/8/2026", reason: "Suspicious account activity from admin dashboard", beats: 1.00 },
    { id: "b-3", username: "kaskal", email: "yareemadogo@gmail.com", date: "4/8/2026", reason: "Suspicious account activity from admin dashboard", beats: 1.00 },
    { id: "b-4", username: "pisda", email: "yareemadogo@gmail.com", date: "4/8/2026", reason: "Suspicious account activity from admin dashboard", beats: 1.00 },
    { id: "b-5", username: "cillo", email: "deeeyo07030110455kingsaleeq@gmail.com", date: "4/8/2026", reason: "Suspicious account activity from admin dashboard", beats: 1.10 },
    { id: "b-6", username: "kilide", email: "deeeyo07030110455kingsaleeq@gmail.com", date: "4/8/2026", reason: "Suspicious account activity from admin dashboard", beats: 1.10 },
    { id: "b-7", username: "triplie", email: "koria121212@gmail.com", date: "4/8/2026", reason: "Suspicious account activity from admin dashboard", beats: 1.10 },
    { id: "b-8", username: "dunai", email: "suspicious_account@admin.com", date: "4/8/2026", reason: "Suspicious account activity from admin dashboard", beats: 1.10 },
];

const INITIAL_HIGH_RISK: HighRiskUser[] = [
    { id: "hr-1", username: "Binhassan", country: "NG", riskScore: 450, alerts30d: 45, failedTrips: 0, lastActivity: "9/8/2026" },
    { id: "hr-2", username: "ENUGU", country: "NG", riskScore: 390, alerts30d: 39, failedTrips: 0, lastActivity: "9/7/2026" },
    { id: "hr-3", username: "iamdoank", country: "ID", riskScore: 390, alerts30d: 39, failedTrips: 0, lastActivity: "9/22/2026" },
    { id: "hr-4", username: "Gembul", country: "ID", riskScore: 380, alerts30d: 38, failedTrips: 0, lastActivity: "9/23/2026" },
    { id: "hr-5", username: "abbasdgk", country: "PK", riskScore: 380, alerts30d: 38, failedTrips: 0, lastActivity: "9/21/2026" },
    { id: "hr-6", username: "churniajs", country: "ID", riskScore: 370, alerts30d: 37, failedTrips: 0, lastActivity: "9/17/2026" },
    { id: "hr-7", username: "starboy5", country: "NG", riskScore: 350, alerts30d: 35, failedTrips: 0, lastActivity: "9/7/2026" },
    { id: "hr-8", username: "aszan", country: "NG", riskScore: 340, alerts30d: 34, failedTrips: 0, lastActivity: "9/14/2026" },
];

const INITIAL_HARDWARE_BANS: HardwareBan[] = [
    { id: "hw-1", androidId: "a1b2c3d4e5f67890", fingerprint: "samsung/a52/a52:13/TP1A.220624", date: "4/8/2026", reason: "GPS Spoofing Emulator" },
    { id: "hw-2", androidId: "f8e7d6c5b4a32109", fingerprint: "google/pixel5/pixel5:12/SP1A.210812", date: "4/6/2026", reason: "Modified APK Telemetry" },
    { id: "hw-3", androidId: "1122334455667788", fingerprint: "xiaomi/redmi9/redmi9:11/RKQ1.200826", date: "4/3/2026", reason: "Synthetic IMU variance injection" },
];

export default function FraudDashboard() {
    const [activeTab, setActiveTab] = useState<TabType>("alerts");
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [selectedUsername, setSelectedUsername] = useState<string>("makgrics");
    const [selectedUserCountry, setSelectedUserCountry] = useState<string>("NG");

    const [incidents] = useState<IncidentItem[]>(INITIAL_INCIDENTS);
    const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>(INITIAL_BLOCKED_USERS);
    const [highRiskUsers, setHighRiskUsers] = useState<HighRiskUser[]>(INITIAL_HIGH_RISK);
    const [hardwareBans, setHardwareBans] = useState<HardwareBan[]>(INITIAL_HARDWARE_BANS);
    const [sanctionSubTab, setSanctionSubTab] = useState<"users" | "devices">("users");
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleInvestigateUser = (username: string, country: string = "NG") => {
        setSelectedUsername(username);
        setSelectedUserCountry(country);
        setSelectedUserId(`u-${username.toLowerCase()}`);
        setActiveTab("investigate");
    };

    const handleUnbanUser = (id: string) => {
        setBlockedUsers((prev) => prev.filter((u) => u.id !== id));
    };

    const handleBanUser = (username: string) => {
        const newBlocked: BlockedUser = {
            id: `b-${Date.now()}`,
            username,
            email: `${username.toLowerCase()}@investigated.com`,
            date: new Date().toLocaleDateString(),
            reason: "Incident Lock / Security Flag Enforcement",
            beats: 0.00
        };
        setBlockedUsers((prev) => [newBlocked, ...prev]);
        setHighRiskUsers((prev) => prev.filter((u) => u.username !== username));
    };

    const handleRemoveHardwareBan = (id: string) => {
        setHardwareBans((prev) => prev.filter((hw) => hw.id !== id));
    };

    const triggerRefresh = () => {
        setIsRefreshing(true);
        setTimeout(() => setIsRefreshing(false), 500);
    };

    return (
        <div className="space-y-5 max-w-7xl mx-auto animate-in fade-in duration-500 pb-12 font-sans">
            {/* Security Center Header */}
            <PageHeader
                title="Security Center"
                subtitle="SECURITY / FRAUD RADAR"
                actions={
                    <div className="flex items-center gap-6">
                        {/* Radar Status Indicator */}
                        <div className="flex items-center gap-3 border-r border-slate-800/80 pr-6">
                            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500">
                                <ShieldAlert className="w-5 h-5 animate-pulse" />
                            </div>
                            <div>
                                <h2 className="text-[11px] font-black text-white uppercase leading-none mb-1">
                                    RADAR STATUS
                                </h2>
                                <p className="text-[9px] text-rose-500 uppercase tracking-widest font-mono font-black animate-pulse">
                                    ACTIVE SCANNING
                                </p>
                            </div>
                        </div>

                        {/* Critical & Total (24h) Counts */}
                        <div className="flex items-center gap-5">
                            <div className="flex flex-col items-center">
                                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black mb-1">
                                    CRITICAL
                                </p>
                                <p className="text-xl font-black text-rose-500 leading-none">
                                    50
                                </p>
                            </div>
                            <div className="flex flex-col items-center border-l border-slate-800/80 pl-5">
                                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black mb-1">
                                    TOTAL (24H)
                                </p>
                                <p className="text-xl font-black text-white leading-none">
                                    50
                                </p>
                            </div>
                        </div>
                    </div>
                }
            />

            {/* Central Navigation Tabs */}
            <nav className="flex items-center justify-between bg-[#121e31]/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-800/80 w-full max-w-3xl mx-auto shadow-sm">
                {[
                    { id: "alerts", label: "SECURITY FEED", icon: Activity },
                    { id: "investigate", label: "INVESTIGATION", icon: Eye },
                    { id: "sanctioned", label: "SANCTIONED", icon: Ban },
                    { id: "high-risk", label: "RISK MONITOR", icon: TrendingUp },
                ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;

                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabType)}
                            className={cn(
                                "flex items-center flex-1 justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-200",
                                isActive
                                    ? "bg-[#02C394] text-slate-950 font-black shadow-md shadow-[#02C394]/20 scale-[1.02]"
                                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                            )}
                        >
                            <Icon className="w-4 h-4 shrink-0" />
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    );
                })}
            </nav>

            {/* Content Views */}
            <div className="pt-2">
                {/* 1. SECURITY FEED TAB (Image 1) */}
                {activeTab === "alerts" && (
                    <div className="bg-[#121e31]/80 border border-slate-800/80 rounded-2xl overflow-hidden shadow-lg backdrop-blur-md">
                        {/* Feed Header */}
                        <div className="p-4 px-6 border-b border-slate-800/80 flex justify-between items-center bg-slate-900/40">
                            <div className="flex items-center gap-2.5">
                                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">
                                    LIVE INCIDENT TIMELINE
                                </h3>
                                <span className="w-2 h-2 rounded-full bg-[#02C394] animate-pulse" />
                            </div>
                            <button
                                onClick={triggerRefresh}
                                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                            >
                                <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin text-[#02C394]")} />
                            </button>
                        </div>

                        {/* Incidents List */}
                        <div className="divide-y divide-slate-800/60 max-h-[70vh] overflow-y-auto">
                            {incidents.map((inc, idx) => {
                                const isSelected = idx === 1; // Row 2 selected highlighted style matching image

                                return (
                                    <div
                                        key={inc.id}
                                        className={cn(
                                            "p-4 px-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-800/30 transition-all relative group",
                                            isSelected && "bg-slate-800/40 border-l-4 border-l-[#02C394]"
                                        )}
                                    >
                                        {/* Severity Tag */}
                                        <div className="flex items-center gap-4 shrink-0">
                                            <div
                                                className={cn(
                                                    "w-20 py-1.5 flex items-center justify-center rounded-lg text-[10px] font-black uppercase border shrink-0 tracking-wider shadow-sm",
                                                    inc.severity === "CRITICAL"
                                                        ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                                                        : "bg-rose-500/10 text-rose-300 border-rose-500/20"
                                                )}
                                            >
                                                {inc.severity}
                                            </div>

                                            {/* Avatar & User */}
                                            <div className="flex items-center gap-3 w-36 shrink-0">
                                                <div className="w-8 h-8 rounded-lg bg-[#02C394]/15 border border-[#02C394]/30 flex items-center justify-center font-black text-[#02C394] text-xs">
                                                    {inc.username[0].toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <span className="text-xs font-black text-white block truncate">
                                                        {inc.username}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-mono uppercase font-bold">
                                                        {inc.country}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Incident Event Description */}
                                        <div className="flex-1 min-w-0 md:px-4">
                                            <p
                                                className={cn(
                                                    "text-[13px] font-extrabold tracking-tight mb-1",
                                                    isSelected ? "text-[#02C394]" : "text-white group-hover:text-[#02C394] transition-colors"
                                                )}
                                            >
                                                {inc.eventType}
                                            </p>
                                            <div className="flex items-center gap-4 text-[10px] text-slate-400 font-mono">
                                                <span className="flex items-center gap-1.5">
                                                    <Smartphone className="w-3 h-3 text-slate-500" />
                                                    {inc.deviceModel}
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <MapPin className="w-3 h-3 text-slate-500" />
                                                    {inc.distance}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Timestamp & Action Button */}
                                        <div className="flex items-center gap-5 shrink-0 justify-between md:justify-end">
                                            <div className="text-right">
                                                <p className="text-[11px] text-white font-mono font-bold">
                                                    {inc.time}
                                                </p>
                                                <p className="text-[9px] text-slate-400 font-mono">
                                                    {inc.date}
                                                </p>
                                            </div>

                                            <button
                                                onClick={() => handleInvestigateUser(inc.username, inc.country)}
                                                className="px-4 py-2 bg-[#02C394]/10 text-[#02C394] hover:bg-[#02C394] hover:text-slate-950 rounded-xl border border-[#02C394]/30 text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 active:scale-95 shadow-sm"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                                <span>INVESTIGATE</span>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* 2. INVESTIGATION TAB (Image 2 + Target Deep Profile) */}
                {activeTab === "investigate" && (
                    <div className="space-y-6">
                        {!selectedUserId ? (
                            /* Empty State Matching Image 2 */
                            <div className="py-32 flex flex-col items-center justify-center bg-[#121e31]/60 rounded-3xl border-2 border-dashed border-slate-800/80 gap-5 shadow-inner">
                                <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center border border-slate-700/60 shadow-inner">
                                    <Search className="w-9 h-9 text-slate-500" />
                                </div>
                                <div className="text-center space-y-1">
                                    <p className="text-sm text-white font-black uppercase tracking-widest">
                                        NO ACTIVE TARGET
                                    </p>
                                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed max-w-sm">
                                        SELECT AN ENTITY FROM THE SECURITY FEED<br />
                                        TO INITIALIZE DEEP INVESTIGATIVE PROTOCOLS.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            /* Deep Investigation Profile View */
                            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 animate-in fade-in duration-300">
                                {/* Left Side: Profile & Controls */}
                                <div className="xl:col-span-1 space-y-6">
                                    {/* Identity Card */}
                                    <div className="bg-[#121e31]/80 border border-slate-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
                                        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#02C394] via-indigo-500 to-rose-500" />

                                        <div className="flex flex-col items-center">
                                            <div className="w-20 h-20 bg-[#02C394] rounded-2xl flex items-center justify-center text-3xl font-black text-slate-950 mb-3 mt-2 shadow-2xl rotate-2 group-hover:rotate-0 transition-transform duration-500">
                                                {selectedUsername[0].toUpperCase()}
                                            </div>
                                            <h3 className="text-2xl font-black text-white tracking-tight">
                                                {selectedUsername}
                                            </h3>
                                            <p className="text-[10px] text-[#02C394] font-black uppercase tracking-[0.2em] mb-6">
                                                Scout Identity
                                            </p>

                                            <div className="w-full space-y-2 mb-6">
                                                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                        <Activity className="w-3.5 h-3.5 text-[#02C394]" /> Status
                                                    </span>
                                                    <span className="px-2 py-0.5 bg-rose-500/15 text-rose-400 text-[10px] font-black rounded uppercase border border-rose-500/30">
                                                        FLAGGED
                                                    </span>
                                                </div>

                                                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                        <Fingerprint className="w-3.5 h-3.5 text-amber-400" /> Risk Score
                                                    </span>
                                                    <span className="text-xs font-black font-mono text-rose-400">
                                                        390 pt
                                                    </span>
                                                </div>

                                                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                        <Globe className="w-3.5 h-3.5 text-blue-400" /> Region
                                                    </span>
                                                    <span className="text-xs font-black text-white uppercase">
                                                        {selectedUserCountry}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="w-full space-y-2.5">
                                                <button
                                                    onClick={() => handleBanUser(selectedUsername)}
                                                    className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2"
                                                >
                                                    <ShieldX className="w-4 h-4" /> Terminate Identity
                                                </button>
                                                <button
                                                    onClick={() => setSelectedUserId(null)}
                                                    className="w-full py-2.5 bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all"
                                                >
                                                    Clear Target
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Side: Telemetry & Logs */}
                                <div className="xl:col-span-3 space-y-6">
                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {[
                                            { label: "Cloud Uploads", value: "148", color: "text-[#02C394]", icon: Globe },
                                            { label: "Risk Events", value: "39", color: "text-rose-400", icon: AlertCircle },
                                            { label: "Rejections", value: "8", color: "text-amber-400", icon: ShieldX },
                                            { label: "Total Beats", value: "720.5", color: "text-[#02C394]", icon: Activity },
                                        ].map((stat, i) => (
                                            <div
                                                key={i}
                                                className="bg-[#121e31]/80 border border-slate-800/80 rounded-2xl p-4 shadow-sm flex items-center gap-3.5"
                                            >
                                                <div className="w-10 h-10 rounded-xl bg-slate-800/80 flex items-center justify-center">
                                                    <stat.icon className={cn("w-5 h-5", stat.color)} />
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                                                        {stat.label}
                                                    </p>
                                                    <p className={cn("text-xl font-black", stat.color)}>{stat.value}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Fraud Incident Logs */}
                                    <div className="bg-[#121e31]/80 border border-slate-800/80 rounded-2xl overflow-hidden shadow-sm">
                                        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
                                            <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                                                <History className="w-4 h-4 text-rose-400" /> Fraud Incident Logs
                                            </h4>
                                        </div>
                                        <div className="p-4 space-y-3">
                                            <div className="p-3.5 border border-rose-500/20 bg-rose-500/10 rounded-xl flex justify-between items-center">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                                                    <div>
                                                        <p className="text-xs font-black text-white uppercase mb-0.5">
                                                            trip gps country mismatch
                                                        </p>
                                                        <p className="text-[10px] text-slate-400 font-mono">
                                                            Detected telemetry jump outside authorized boundary.
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] text-white font-mono font-bold">9/23/2026</p>
                                                    <p className="text-[9px] text-slate-400 font-mono">1:09:37 PM</p>
                                                </div>
                                            </div>
                                            <div className="p-3.5 border border-amber-500/20 bg-amber-500/10 rounded-xl flex justify-between items-center">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                                                    <div>
                                                        <p className="text-xs font-black text-white uppercase mb-0.5">
                                                            trip validation anomaly
                                                        </p>
                                                        <p className="text-[10px] text-slate-400 font-mono">
                                                            High frequency frame bursts within 0.34km range.
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] text-white font-mono font-bold">9/22/2026</p>
                                                    <p className="text-[9px] text-slate-400 font-mono">4:15:20 PM</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 3. SANCTIONED TAB (Image 3) */}
                {activeTab === "sanctioned" && (
                    <div className="space-y-5">
                        {/* Subtabs: Blocked Users & Blacklisted Hardware */}
                        <div className="flex gap-6 border-b border-slate-800/80 px-2">
                            <button
                                onClick={() => setSanctionSubTab("users")}
                                className={cn(
                                    "pb-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all",
                                    sanctionSubTab === "users"
                                        ? "border-rose-500 text-white"
                                        : "border-transparent text-slate-400 hover:text-white"
                                )}
                            >
                                BLOCKED USERS ({blockedUsers.length})
                            </button>
                            <button
                                onClick={() => setSanctionSubTab("devices")}
                                className={cn(
                                    "pb-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all",
                                    sanctionSubTab === "devices"
                                        ? "border-rose-500 text-white"
                                        : "border-transparent text-slate-400 hover:text-white"
                                )}
                            >
                                BLACKLISTED HARDWARE ({hardwareBans.length})
                            </button>
                        </div>

                        {/* Table */}
                        <div className="bg-[#121e31]/80 border border-slate-800/80 rounded-2xl overflow-hidden shadow-sm backdrop-blur-md">
                            <div className="overflow-x-auto">
                                {sanctionSubTab === "users" ? (
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-900/40 border-b border-slate-800/80">
                                            <tr>
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                                    USER ENTITY
                                                </th>
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                                    ENFORCEMENT DATE
                                                </th>
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                                    PRIMARY JUSTIFICATION
                                                </th>
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                                    BEATS
                                                </th>
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">
                                                    ACTIONS
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/60">
                                            {blockedUsers.map((user) => (
                                                <tr
                                                    key={user.id}
                                                    className="hover:bg-slate-800/30 transition-colors group"
                                                >
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 font-black text-xs">
                                                                {user.username[0].toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-black text-white">
                                                                    {user.username}
                                                                </p>
                                                                <p className="text-[10px] text-slate-400 font-mono">
                                                                    {user.email}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-xs font-mono text-slate-300">
                                                        {user.date}
                                                    </td>
                                                    <td className="px-6 py-4 max-w-xs text-xs text-slate-400 font-medium">
                                                        {user.reason}
                                                    </td>
                                                    <td className="px-6 py-4 text-xs font-mono font-bold text-white">
                                                        {user.beats.toFixed(2)}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <button
                                                                onClick={() => handleInvestigateUser(user.username)}
                                                                className="p-2 bg-slate-800 hover:bg-[#02C394]/15 hover:text-[#02C394] rounded-lg border border-slate-700 text-slate-400 transition-colors"
                                                                title="View Investigation"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleUnbanUser(user.id)}
                                                                className="p-2 bg-slate-800 hover:bg-emerald-500/15 hover:text-emerald-400 rounded-lg border border-slate-700 text-slate-400 transition-colors"
                                                                title="Revoke Ban"
                                                            >
                                                                <Unlock className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-900/40 border-b border-slate-800/80">
                                            <tr>
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                                    DEVICE IDENTIFIER
                                                </th>
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                                    HARDWARE FINGERPRINT
                                                </th>
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                                    ENFORCEMENT DATE
                                                </th>
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                                    REASON
                                                </th>
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">
                                                    ACTIONS
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/60">
                                            {hardwareBans.map((hw) => (
                                                <tr
                                                    key={hw.id}
                                                    className="hover:bg-slate-800/30 transition-colors"
                                                >
                                                    <td className="px-6 py-4 text-xs font-mono text-white font-bold">
                                                        {hw.androidId}
                                                    </td>
                                                    <td className="px-6 py-4 text-xs font-mono text-slate-400 truncate max-w-[200px]">
                                                        {hw.fingerprint}
                                                    </td>
                                                    <td className="px-6 py-4 text-xs font-mono text-slate-300">
                                                        {hw.date}
                                                    </td>
                                                    <td className="px-6 py-4 text-xs text-slate-400">
                                                        {hw.reason}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => handleRemoveHardwareBan(hw.id)}
                                                            className="p-2 bg-slate-800 hover:bg-rose-500/15 hover:text-rose-400 rounded-lg border border-slate-700 text-slate-400 transition-colors"
                                                            title="Remove Blacklist"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 4. RISK MONITOR TAB (Image 4) */}
                {activeTab === "high-risk" && (
                    <div className="bg-[#121e31]/80 border border-slate-800/80 rounded-2xl overflow-hidden shadow-sm backdrop-blur-md">
                        {/* Table Header */}
                        <div className="p-4 px-6 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/40">
                            <h4 className="text-xs font-black text-white uppercase tracking-[0.2em] flex items-center gap-2.5">
                                <TrendingUp className="w-4 h-4 text-rose-500" />
                                HIGH RISK SURVEILLANCE
                            </h4>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                UPDATED IN REAL-TIME
                            </span>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="border-b border-slate-800/60">
                                    <tr>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                            ENTITY
                                        </th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                            RISK SCORE
                                        </th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">
                                            ALERTS (30D)
                                        </th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">
                                            FAILED TRIPS
                                        </th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                            LAST ACTIVITY
                                        </th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">
                                            ACTIONS
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {highRiskUsers.map((user) => (
                                        <tr
                                            key={user.id}
                                            className="hover:bg-slate-800/30 transition-colors group"
                                        >
                                            <td className="px-6 py-4">
                                                <p className="text-xs font-black text-white">
                                                    {user.username}
                                                </p>
                                                <p className="text-[10px] text-slate-400 font-mono uppercase font-bold">
                                                    {user.country}
                                                </p>
                                            </td>

                                            {/* Risk Score Progress Bar & Number */}
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1 w-28">
                                                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]"
                                                            style={{
                                                                width: `${Math.min((user.riskScore / 500) * 100, 100)}%`
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] font-black font-mono text-rose-500 text-right">
                                                        {user.riskScore}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Alerts (30d) */}
                                            <td className="px-6 py-4 text-center">
                                                <span className="px-2.5 py-0.5 bg-rose-500/15 text-rose-400 text-[10px] font-black rounded-lg border border-rose-500/25">
                                                    {user.alerts30d}
                                                </span>
                                            </td>

                                            {/* Failed Trips */}
                                            <td className="px-6 py-4 text-center text-xs font-mono font-bold text-white">
                                                {user.failedTrips}
                                            </td>

                                            {/* Last Activity */}
                                            <td className="px-6 py-4">
                                                <p className="text-[11px] text-white font-mono font-bold">
                                                    {user.lastActivity}
                                                </p>
                                                <p className="text-[9px] text-slate-400 font-mono uppercase font-bold">
                                                    INCIDENT LOCK
                                                </p>
                                            </td>

                                            {/* Actions */}
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleInvestigateUser(user.username, user.country)}
                                                        className="px-3.5 py-1.5 bg-[#02C394]/10 text-[#02C394] hover:bg-[#02C394] hover:text-slate-950 rounded-lg border border-[#02C394]/30 text-[9px] font-black uppercase tracking-wider transition-all"
                                                    >
                                                        ANALYZE
                                                    </button>
                                                    <button
                                                        onClick={() => handleBanUser(user.username)}
                                                        className="p-1.5 bg-rose-500/15 text-rose-400 hover:bg-rose-600 hover:text-white rounded-lg border border-rose-500/30 transition-all"
                                                        title="Immediate Ban"
                                                    >
                                                        <ShieldX className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
