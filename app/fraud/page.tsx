"use client";

import React, { useState, useEffect, useCallback } from "react";
import PageHeader from "@/components/layout/PageHeader";
import {
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
    AlertCircle,
    Loader2
} from "lucide-react";
import { cn, safeToFixed } from "@/lib/utils";

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
        userId: "u-makgrics",
        username: "makgrics",
        country: "NG",
        eventType: "trip gps country mismatch",
        deviceModel: "Infinix X6833B",
        distance: "0.22km",
        time: "1:09:37 PM",
        date: "9/23/2026",
        severity: "CRITICAL"
    },
    {
        id: "inc-2",
        userId: "u-makgrics",
        username: "makgrics",
        country: "NG",
        eventType: "trip validation anomaly",
        deviceModel: "Infinix X6833B",
        distance: "0.34km",
        time: "1:07:07 PM",
        date: "9/23/2026",
        severity: "HIGH"
    },
    {
        id: "inc-3",
        userId: "u-muktar",
        username: "muktar",
        country: "IN",
        eventType: "trip gps country mismatch",
        deviceModel: "TECNO KL4",
        distance: "N/Akm",
        time: "12:56:49 PM",
        date: "9/23/2026",
        severity: "CRITICAL"
    },
    {
        id: "inc-4",
        userId: "u-muktar",
        username: "muktar",
        country: "IN",
        eventType: "trip validation anomaly",
        deviceModel: "TECNO KL4",
        distance: "N/Akm",
        time: "12:47:35 PM",
        date: "9/23/2026",
        severity: "HIGH"
    },
    {
        id: "inc-5",
        userId: "u-gembul",
        username: "Gembul",
        country: "ID",
        eventType: "trip validation anomaly",
        deviceModel: "V2520",
        distance: "3.75km",
        time: "12:28:44 PM",
        date: "9/23/2026",
        severity: "HIGH"
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

    const [incidents, setIncidents] = useState<IncidentItem[]>(INITIAL_INCIDENTS);
    const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>(INITIAL_BLOCKED_USERS);
    const [highRiskUsers, setHighRiskUsers] = useState<HighRiskUser[]>(INITIAL_HIGH_RISK);
    const [hardwareBans, setHardwareBans] = useState<HardwareBan[]>(INITIAL_HARDWARE_BANS);
    const [sanctionSubTab, setSanctionSubTab] = useState<"users" | "devices">("users");
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch all fraud data from live API (global — no country filter)
    const fetchFraudData = useCallback(async () => {
        try {
            const [eventsRes, bannedRes, highRiskRes, devicesRes] = await Promise.all([
                fetch("/api/fraud?type=events&limit=50"),
                fetch("/api/fraud?type=banned-users&limit=50&offset=0"),
                fetch("/api/fraud?type=high-risk&limit=50&offset=0"),
                fetch("/api/fraud?type=banned-devices&limit=50&offset=0"),
            ]);

            if (eventsRes.ok) {
                const events = await eventsRes.json() as Array<{
                    id: string; user_id: string; username: string; country_code: string;
                    event_type: string; device_model: string; trip_distance: number;
                    created_at: string; severity: string;
                }>;
                if (Array.isArray(events) && events.length > 0) {
                    setIncidents(events.map((e) => ({
                        id: e.id,
                        userId: e.user_id,
                        username: e.username || "Unknown",
                        country: e.country_code || "??",
                        eventType: e.event_type,
                        deviceModel: e.device_model || "Unknown Device",
                        distance: e.trip_distance ? `${e.trip_distance.toFixed(2)}km` : "N/Akm",
                        time: new Date(e.created_at).toLocaleTimeString(),
                        date: new Date(e.created_at).toLocaleDateString(),
                        severity: (e.severity === "CRITICAL" ? "CRITICAL" : e.severity === "HIGH" ? "HIGH" : "MEDIUM") as "CRITICAL" | "HIGH" | "MEDIUM",
                    })));
                }
            }

            if (bannedRes.ok) {
                const banned = await bannedRes.json() as { users: Array<{
                    id: string; username: string; email: string; banned_at: string;
                    ban_reason: string; total_beats: number;
                }> };
                if (banned.users && banned.users.length > 0) {
                    setBlockedUsers(banned.users.map((u) => ({
                        id: u.id,
                        username: u.username || "Unknown",
                        email: u.email || "",
                        date: new Date(u.banned_at).toLocaleDateString(),
                        reason: u.ban_reason || "Banned by admin",
                        beats: u.total_beats || 0,
                    })));
                }
            }

            if (highRiskRes.ok) {
                const risk = await highRiskRes.json() as { users: Array<{
                    id: string; username: string; country_code: string;
                    risk_score: number; alerts_30d: number; failed_trips: number;
                    last_activity: string;
                }> };
                if (risk.users && risk.users.length > 0) {
                    setHighRiskUsers(risk.users.map((u) => ({
                        id: u.id,
                        username: u.username || "Unknown",
                        country: u.country_code || "??",
                        riskScore: u.risk_score,
                        alerts30d: u.alerts_30d,
                        failedTrips: u.failed_trips,
                        lastActivity: u.last_activity ? new Date(u.last_activity).toLocaleDateString() : "N/A",
                    })));
                }
            }

            if (devicesRes.ok) {
                const devices = await devicesRes.json() as { bans: Array<{
                    id: string; android_id?: string; device_fingerprint?: string;
                    created_at: string; reason: string;
                }> };
                if (devices.bans && devices.bans.length > 0) {
                    setHardwareBans(devices.bans.map((d) => ({
                        id: d.id || `hw-${Date.now()}`,
                        androidId: d.android_id || d.device_fingerprint || "Unknown",
                        fingerprint: d.device_fingerprint || "Unknown",
                        date: new Date(d.created_at).toLocaleDateString(),
                        reason: d.reason || "Banned",
                    })));
                }
            }
        } catch (err) {
            console.warn("Fraud API unavailable, using mock data:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchFraudData();
    }, [fetchFraudData]);

    const handleInvestigateUser = (username: string, country: string = "NG") => {
        setSelectedUsername(username);
        setSelectedUserCountry(country);
        setSelectedUserId(`u-${username.toLowerCase()}`);
        setActiveTab("investigate");
    };

    const handleUnbanUser = (id: string) => {
        setBlockedUsers((prev) => prev.filter((u) => u.id !== id));
        fetch("/api/admin/admin/unban-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: id }),
        }).catch(() => { /* silent fail */ });
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
        fetch("/api/fraud", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "ban-user", targetId: username, reason: "Incident Lock / Security Flag Enforcement" }),
        }).catch(() => { /* silent fail */ });
    };

    const handleRemoveHardwareBan = (id: string) => {
        setHardwareBans((prev) => prev.filter((hw) => hw.id !== id));
    };

    const triggerRefresh = () => {
        setIsRefreshing(true);
        fetchFraudData().finally(() => {
            setTimeout(() => setIsRefreshing(false), 500);
        });
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500 pb-12 font-sans">
            {/* Security Center Header */}
            <PageHeader
                title="Security Radar"
                subtitle="ANOMALY & FRAUD SURVEILLANCE"
                actions={
                    <div className="flex items-center gap-4 sm:gap-6 bg-card border border-border-subtle rounded-2xl px-4 py-2 shadow-sm">
                        {/* Radar Status Indicator */}
                        <div className="flex items-center gap-2.5 border-r border-border-subtle pr-4">
                            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                            <div>
                                <h2 className="text-[10px] font-bold text-foreground uppercase leading-none">
                                    SURVEILLANCE
                                </h2>
                                <p className="text-[9px] text-rose-400 uppercase tracking-widest font-mono font-bold mt-0.5">
                                    ACTIVE SCAN
                                </p>
                            </div>
                        </div>

                        {/* Critical & Total (24h) Counts */}
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col items-center">
                                <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold mb-0.5">
                                    CRITICAL
                                </p>
                                <p className="text-base font-extrabold text-rose-500 leading-none font-mono">
                                    {incidents.filter(i => i.severity === 'CRITICAL').length || 8}
                                </p>
                            </div>
                            <div className="flex flex-col items-center border-l border-border-subtle pl-4">
                                <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold mb-0.5">
                                    INCIDENTS
                                </p>
                                <p className="text-base font-extrabold text-foreground leading-none font-mono">
                                    {incidents.length}
                                </p>
                            </div>
                        </div>
                    </div>
                }
            />

            {/* Central Navigation Tabs */}
            <nav className="flex items-center justify-between bg-card p-1.5 rounded-2xl border border-border-subtle w-full max-w-2xl mx-auto shadow-sm">
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
                                "flex items-center flex-1 justify-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer",
                                isActive
                                    ? "bg-brand-blue text-slate-950 font-extrabold shadow-md shadow-brand-blue/20 scale-[1.01]"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted-background/60"
                            )}
                        >
                            <Icon className="w-3.5 h-3.5 shrink-0" />
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    );
                })}
            </nav>

            {/* Content Views */}
            <div className="pt-1">
                {isLoading ? (
                    <div className="py-24 flex flex-col items-center justify-center gap-4 bg-card rounded-2xl border border-border-subtle shadow-sm">
                        <Loader2 className="w-8 h-8 text-brand-blue animate-spin" />
                        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Scanning fraud telemetries...</p>
                    </div>
                ) : (
                    <>
                        {/* 1. SECURITY FEED TAB */}
                        {activeTab === "alerts" && (
                            <div className="bg-card border border-border-subtle rounded-2xl overflow-hidden shadow-sm">
                                {/* Feed Header */}
                                <div className="p-4 px-6 border-b border-border-subtle flex justify-between items-center bg-muted-background/40">
                                    <div className="flex items-center gap-2.5">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">
                                            LIVE INCIDENT TIMELINE
                                        </h3>
                                        <span className="w-2 h-2 rounded-full bg-brand-blue animate-pulse" />
                                    </div>
                                    <button
                                        onClick={triggerRefresh}
                                        className="p-1.5 hover:bg-muted-background rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                        title="Refresh Incidents"
                                    >
                                        <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin text-brand-blue")} />
                                    </button>
                                </div>

                                {/* Incidents List */}
                                <div className="divide-y divide-border-subtle max-h-[70vh] overflow-y-auto">
                                    {incidents.map((inc, idx) => {
                                        const isSelected = idx === 1;

                                        return (
                                            <div
                                                key={inc.id}
                                                className={cn(
                                                    "p-4 px-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted-background/30 transition-all relative group",
                                                    isSelected && "bg-muted-background/40 border-l-4 border-l-brand-blue"
                                                )}
                                            >
                                                {/* Severity Tag & User */}
                                                <div className="flex items-center gap-4 shrink-0">
                                                    <div
                                                        className={cn(
                                                            "w-20 py-1.5 flex items-center justify-center rounded-lg text-[10px] font-black uppercase border shrink-0 tracking-wider shadow-sm",
                                                            inc.severity === "CRITICAL"
                                                                ? "bg-rose-500/10 text-rose-400 border-rose-500/25"
                                                                : "bg-amber-500/10 text-amber-400 border-amber-500/25"
                                                        )}
                                                    >
                                                        {inc.severity}
                                                    </div>

                                                    <div className="flex items-center gap-3 w-36 shrink-0">
                                                        <div className="w-8 h-8 rounded-lg bg-brand-blue/15 border border-brand-blue/30 flex items-center justify-center font-black text-brand-blue text-xs shadow-sm">
                                                            {inc.username[0].toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <span className="text-xs font-bold text-foreground block truncate">
                                                                {inc.username}
                                                            </span>
                                                            <span className="text-[10px] text-muted-foreground font-mono uppercase font-bold">
                                                                {inc.country}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Incident Event Description */}
                                                <div className="flex-1 min-w-0 md:px-4">
                                                    <p
                                                        className={cn(
                                                            "text-[13px] font-bold tracking-tight mb-1",
                                                            isSelected ? "text-brand-blue" : "text-foreground group-hover:text-brand-blue transition-colors"
                                                        )}
                                                    >
                                                        {inc.eventType}
                                                    </p>
                                                    <div className="flex items-center gap-4 text-[10px] text-muted-foreground font-mono">
                                                        <span className="flex items-center gap-1.5">
                                                            <Smartphone className="w-3 h-3 text-muted-foreground/70" />
                                                            {inc.deviceModel}
                                                        </span>
                                                        <span className="flex items-center gap-1.5">
                                                            <MapPin className="w-3 h-3 text-muted-foreground/70" />
                                                            {inc.distance}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Timestamp & Action Button */}
                                                <div className="flex items-center gap-5 shrink-0 justify-between md:justify-end">
                                                    <div className="text-right">
                                                        <p className="text-[11px] text-foreground font-mono font-bold">
                                                            {inc.time}
                                                        </p>
                                                        <p className="text-[9px] text-muted-foreground font-mono">
                                                            {inc.date}
                                                        </p>
                                                    </div>

                                                    <button
                                                        onClick={() => handleInvestigateUser(inc.username, inc.country)}
                                                        className="px-3.5 py-1.5 bg-brand-blue/10 text-brand-blue hover:bg-brand-blue hover:text-slate-950 rounded-xl border border-brand-blue/30 text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-95 shadow-sm cursor-pointer"
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

                        {/* 2. INVESTIGATION TAB */}
                        {activeTab === "investigate" && (
                            <div className="space-y-6">
                                {!selectedUserId ? (
                                    <div className="py-24 flex flex-col items-center justify-center bg-card rounded-2xl border-2 border-dashed border-border-subtle gap-4 shadow-sm">
                                        <div className="w-16 h-16 bg-muted-background rounded-2xl flex items-center justify-center border border-border-subtle shadow-sm">
                                            <Search className="w-7 h-7 text-muted-foreground" />
                                        </div>
                                        <div className="text-center space-y-1">
                                            <p className="text-sm text-foreground font-bold uppercase tracking-widest">
                                                NO TARGET SELECTED
                                            </p>
                                            <p className="text-xs text-muted-foreground max-w-sm">
                                                Select an incident from the Security Feed to inspect user telemetries.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 animate-in fade-in duration-300">
                                        {/* Left Side: Profile & Controls */}
                                        <div className="xl:col-span-1 space-y-6">
                                            <div className="bg-card border border-border-subtle rounded-2xl p-6 shadow-sm relative overflow-hidden group">
                                                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-brand-blue via-cyan-500 to-rose-500" />

                                                <div className="flex flex-col items-center">
                                                    <div className="w-18 h-18 bg-brand-blue rounded-2xl flex items-center justify-center text-3xl font-black text-slate-950 mb-3 mt-2 shadow-lg">
                                                        {selectedUsername[0].toUpperCase()}
                                                    </div>
                                                    <h3 className="text-xl font-bold text-foreground tracking-tight">
                                                        {selectedUsername}
                                                    </h3>
                                                    <p className="text-[10px] text-brand-blue font-bold uppercase tracking-widest mb-5">
                                                        Scout Identity
                                                    </p>

                                                    <div className="w-full space-y-2 mb-6">
                                                        <div className="bg-card p-3 rounded-xl border border-border-subtle flex justify-between items-center">
                                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                                                <Activity className="w-3.5 h-3.5 text-brand-blue" /> Status
                                                            </span>
                                                            <span className="px-2 py-0.5 bg-rose-500/15 text-rose-400 text-[10px] font-bold rounded uppercase border border-rose-500/30">
                                                                FLAGGED
                                                            </span>
                                                        </div>

                                                        <div className="bg-card p-3 rounded-xl border border-border-subtle flex justify-between items-center">
                                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                                                <Fingerprint className="w-3.5 h-3.5 text-amber-400" /> Risk Score
                                                            </span>
                                                            <span className="text-xs font-bold font-mono text-rose-400">
                                                                390 pt
                                                            </span>
                                                        </div>

                                                        <div className="bg-card p-3 rounded-xl border border-border-subtle flex justify-between items-center">
                                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                                                <Globe className="w-3.5 h-3.5 text-blue-400" /> Region
                                                            </span>
                                                            <span className="text-xs font-bold text-foreground uppercase">
                                                                {selectedUserCountry}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="w-full space-y-2.5">
                                                        <button
                                                            onClick={() => handleBanUser(selectedUsername)}
                                                            className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                                                        >
                                                            <ShieldX className="w-4 h-4" /> Enforce Ban
                                                        </button>
                                                        <button
                                                            onClick={() => setSelectedUserId(null)}
                                                            className="w-full py-2 bg-muted-background border border-border-subtle text-muted-foreground hover:text-foreground rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                                                        >
                                                            Clear Target
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right Side: Telemetry & Logs */}
                                        <div className="xl:col-span-3 space-y-6">
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                {[
                                                    { label: "Cloud Uploads", value: "148", color: "text-brand-blue", icon: Globe },
                                                    { label: "Risk Events", value: "39", color: "text-rose-400", icon: AlertCircle },
                                                    { label: "Rejections", value: "8", color: "text-amber-400", icon: ShieldX },
                                                    { label: "Total Beats", value: "720.5", color: "text-brand-blue", icon: Activity },
                                                ].map((stat, i) => (
                                                    <div
                                                        key={i}
                                                        className="bg-card border border-border-subtle rounded-2xl p-4 shadow-sm flex items-center gap-3.5"
                                                    >
                                                        <div className="w-10 h-10 rounded-xl bg-muted-background border border-border-subtle flex items-center justify-center">
                                                            <stat.icon className={cn("w-5 h-5", stat.color)} />
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">
                                                                {stat.label}
                                                            </p>
                                                            <p className={cn("text-xl font-bold font-mono", stat.color)}>{stat.value}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="bg-card border border-border-subtle rounded-2xl overflow-hidden shadow-sm">
                                                <div className="p-4 px-5 border-b border-border-subtle flex items-center justify-between bg-muted-background/40">
                                                    <h4 className="text-xs font-bold text-foreground uppercase tracking-widest flex items-center gap-2">
                                                        <History className="w-4 h-4 text-rose-400" /> Fraud Incident Logs
                                                    </h4>
                                                </div>
                                                <div className="p-4 space-y-3">
                                                    <div className="p-3.5 border border-rose-500/20 bg-rose-500/10 rounded-xl flex justify-between items-center">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                                                            <div>
                                                                <p className="text-xs font-bold text-foreground uppercase mb-0.5">
                                                                    trip gps country mismatch
                                                                </p>
                                                                <p className="text-[10px] text-muted-foreground font-mono">
                                                                    Detected telemetry jump outside authorized boundary.
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[10px] text-foreground font-mono font-bold">9/23/2026</p>
                                                            <p className="text-[9px] text-muted-foreground font-mono">1:09:37 PM</p>
                                                        </div>
                                                    </div>
                                                    <div className="p-3.5 border border-amber-500/20 bg-amber-500/10 rounded-xl flex justify-between items-center">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-2 h-2 rounded-full bg-amber-500" />
                                                            <div>
                                                                <p className="text-xs font-bold text-foreground uppercase mb-0.5">
                                                                    trip validation anomaly
                                                                </p>
                                                                <p className="text-[10px] text-muted-foreground font-mono">
                                                                    High frequency frame bursts within 0.34km range.
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[10px] text-foreground font-mono font-bold">9/22/2026</p>
                                                            <p className="text-[9px] text-muted-foreground font-mono">4:15:20 PM</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 3. SANCTIONED TAB */}
                        {activeTab === "sanctioned" && (
                            <div className="space-y-5">
                                <div className="flex gap-4 border-b border-border-subtle px-2">
                                    <button
                                        onClick={() => setSanctionSubTab("users")}
                                        className={cn(
                                            "pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer",
                                            sanctionSubTab === "users"
                                                ? "border-rose-500 text-foreground"
                                                : "border-transparent text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        BLOCKED USERS ({blockedUsers.length})
                                    </button>
                                    <button
                                        onClick={() => setSanctionSubTab("devices")}
                                        className={cn(
                                            "pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer",
                                            sanctionSubTab === "devices"
                                                ? "border-rose-500 text-foreground"
                                                : "border-transparent text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        BLACKLISTED HARDWARE ({hardwareBans.length})
                                    </button>
                                </div>

                                <div className="bg-card border border-border-subtle rounded-2xl overflow-hidden shadow-sm">
                                    <div className="overflow-x-auto">
                                        {sanctionSubTab === "users" ? (
                                            <table className="w-full text-left">
                                                <thead className="bg-muted-background/40 border-b border-border-subtle">
                                                    <tr>
                                                        <th className="px-6 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                                            USER ENTITY
                                                        </th>
                                                        <th className="px-6 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                                            ENFORCEMENT DATE
                                                        </th>
                                                        <th className="px-6 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                                            PRIMARY JUSTIFICATION
                                                        </th>
                                                        <th className="px-6 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                                            BEATS
                                                        </th>
                                                        <th className="px-6 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">
                                                            ACTIONS
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border-subtle">
                                                    {blockedUsers.map((user) => (
                                                        <tr
                                                            key={user.id}
                                                            className="hover:bg-muted-background/30 transition-colors group"
                                                        >
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-400 font-bold text-xs shadow-sm">
                                                                        {user.username[0].toUpperCase()}
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs font-bold text-foreground">
                                                                            {user.username}
                                                                        </p>
                                                                        <p className="text-[10px] text-muted-foreground font-mono">
                                                                            {user.email}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-xs font-mono text-muted-foreground">
                                                                {user.date}
                                                            </td>
                                                            <td className="px-6 py-4 max-w-xs text-xs text-muted-foreground font-medium">
                                                                {user.reason}
                                                            </td>
                                                            <td className="px-6 py-4 text-xs font-mono font-bold text-foreground">
                                                                {safeToFixed(user.beats, 2)}
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <div className="flex justify-end gap-2">
                                                                    <button
                                                                        onClick={() => handleInvestigateUser(user.username)}
                                                                        className="p-1.5 bg-muted-background hover:bg-brand-blue/15 hover:text-brand-blue rounded-lg border border-border-subtle text-muted-foreground transition-colors cursor-pointer"
                                                                        title="View Investigation"
                                                                    >
                                                                        <Eye className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleUnbanUser(user.id)}
                                                                        className="p-1.5 bg-muted-background hover:bg-emerald-500/15 hover:text-emerald-400 rounded-lg border border-border-subtle text-muted-foreground transition-colors cursor-pointer"
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
                                                <thead className="bg-muted-background/40 border-b border-border-subtle">
                                                    <tr>
                                                        <th className="px-6 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                                            DEVICE IDENTIFIER
                                                        </th>
                                                        <th className="px-6 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                                            HARDWARE FINGERPRINT
                                                        </th>
                                                        <th className="px-6 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                                            ENFORCEMENT DATE
                                                        </th>
                                                        <th className="px-6 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                                            REASON
                                                        </th>
                                                        <th className="px-6 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">
                                                            ACTIONS
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border-subtle">
                                                    {hardwareBans.map((hw) => (
                                                        <tr
                                                            key={hw.id}
                                                            className="hover:bg-muted-background/30 transition-colors"
                                                        >
                                                            <td className="px-6 py-4 text-xs font-mono text-foreground font-bold">
                                                                {hw.androidId}
                                                            </td>
                                                            <td className="px-6 py-4 text-xs font-mono text-muted-foreground truncate max-w-[200px]">
                                                                {hw.fingerprint}
                                                            </td>
                                                            <td className="px-6 py-4 text-xs font-mono text-muted-foreground">
                                                                {hw.date}
                                                            </td>
                                                            <td className="px-6 py-4 text-xs text-muted-foreground">
                                                                {hw.reason}
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <button
                                                                    onClick={() => handleRemoveHardwareBan(hw.id)}
                                                                    className="p-1.5 bg-muted-background hover:bg-rose-500/15 hover:text-rose-400 rounded-lg border border-border-subtle text-muted-foreground transition-colors cursor-pointer"
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

                        {/* 4. RISK MONITOR TAB */}
                        {activeTab === "high-risk" && (
                            <div className="bg-card border border-border-subtle rounded-2xl overflow-hidden shadow-sm">
                                <div className="p-4 px-6 border-b border-border-subtle flex items-center justify-between bg-muted-background/40">
                                    <h4 className="text-xs font-bold text-foreground uppercase tracking-widest flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-rose-500" />
                                        HIGH RISK SURVEILLANCE
                                    </h4>
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                        UPDATED IN REAL-TIME
                                    </span>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-muted-background/40 border-b border-border-subtle">
                                            <tr>
                                                <th className="px-6 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                                    ENTITY
                                                </th>
                                                <th className="px-6 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                                    RISK SCORE
                                                </th>
                                                <th className="px-6 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">
                                                    ALERTS (30D)
                                                </th>
                                                <th className="px-6 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">
                                                    FAILED TRIPS
                                                </th>
                                                <th className="px-6 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                                    LAST SEEN
                                                </th>
                                                <th className="px-6 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                                    SURVEILLANCE
                                                </th>
                                                <th className="px-6 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">
                                                    ACTIONS
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border-subtle">
                                            {highRiskUsers.map((user) => (
                                                <tr
                                                    key={user.id}
                                                    className="hover:bg-muted-background/30 transition-colors group"
                                                >
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 font-bold text-xs shadow-sm">
                                                                {user.username[0].toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-bold text-foreground">
                                                                    {user.username}
                                                                </p>
                                                                <p className="text-[10px] text-muted-foreground font-mono uppercase">
                                                                    {user.country}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold font-mono text-rose-400">
                                                                {user.riskScore}
                                                            </span>
                                                            <div className="w-14 h-1.5 bg-muted-background rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-rose-500 rounded-full"
                                                                    style={{ width: `${Math.min(100, (user.riskScore / 500) * 100)}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center text-xs font-mono font-bold text-foreground">
                                                        {user.alerts30d}
                                                    </td>
                                                    <td className="px-6 py-4 text-center text-xs font-mono text-muted-foreground">
                                                        {user.failedTrips}
                                                    </td>
                                                    <td className="px-6 py-4 text-xs font-mono text-muted-foreground">
                                                        {user.lastActivity}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/25">
                                                            INCIDENT LOCK
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <button
                                                                onClick={() => handleInvestigateUser(user.username, user.country)}
                                                                className="px-2.5 py-1.5 bg-brand-blue/10 text-brand-blue hover:bg-brand-blue hover:text-slate-950 rounded-lg border border-brand-blue/30 text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                                                            >
                                                                ANALYZE
                                                            </button>
                                                            <button
                                                                onClick={() => handleBanUser(user.username)}
                                                                className="p-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-600 hover:text-white rounded-lg border border-rose-500/25 transition-all cursor-pointer"
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
                    </>
                )}
            </div>
        </div>
    );
}
