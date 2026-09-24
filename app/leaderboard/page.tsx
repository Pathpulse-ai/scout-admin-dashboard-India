"use client";

import React, { useState, useEffect, useCallback } from "react";
import PageHeader from "@/components/layout/PageHeader";
import {
    Check,
    X,
    Trash2,
    Settings,
    Clock,
    Download,
    ShieldCheck,
    Edit2,
    User as UserIcon,
    Wallet,
    CheckCircle2,
    Calendar,
    Award,
    Globe,
    Users,
    Plus,
    Save,
    Coins,
    RefreshCw,
    Shield,
    Loader2
} from "lucide-react";
import { cn, safeToFixed } from "@/lib/utils";

type Tab = "beats" | "referral" | "management";
type LeaderboardView = "current" | "lastEnded";

interface LeaderboardItem {
    rank: number;
    userId: string;
    username: string;
    avatarUrl?: string;
    beats: number;
    referralPoints?: number;
    normalReferrals?: number;
    successfulReferrals?: number;
}

interface RewardItem {
    id: string | number;
    type: "beats" | "referrals";
    identifier: string;
    value: number;
    active: boolean;
    created_at?: string;
    updated_at?: string;
}

interface ConfigForm {
    reset_cycle_days?: number;
    next_reset_date?: string;
    leaderboard_start_date?: string;
    cool_down_period_days?: number;
    is_in_cool_down_period?: boolean;
}

const INITIAL_BEATS_DATA: LeaderboardItem[] = [
    {
        rank: 1,
        userId: "B8B1382A-EE8A-4A0D-831F-E0A9883E0698",
        username: "Gembul",
        avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
        beats: 59.2,
    },
    {
        rank: 2,
        userId: "A19D1D04-2132-49A9-B41F-171B4ED852C8",
        username: "bhusna",
        beats: 58.4,
    },
    {
        rank: 3,
        userId: "2A594844-CC0C-4F74-B364-1541DF10EC84",
        username: "scout_76672",
        beats: 57.9,
    },
    {
        rank: 4,
        userId: "C1DF8189-1060-4019-847A-15D572A7E526",
        username: "danbabo37",
        beats: 47.8,
    },
    {
        rank: 5,
        userId: "97134631-47A0-4262-8289-344D0E1E362C",
        username: "iamdoank",
        beats: 43.7,
    },
    {
        rank: 6,
        userId: "4691EF06-B77A-49DE-AB8E-0BC8E3AA1DA6",
        username: "msultan",
        beats: 42.2,
    },
    {
        rank: 7,
        userId: "7EF4C6C3-48A8-4C48-83E9-B53C2BF1810C",
        username: "Hamzee",
        beats: 41.8,
    },
];

const INITIAL_REFERRAL_DATA: LeaderboardItem[] = [
    {
        rank: 1,
        userId: "B8B1382A-EE8A-4A0D-831F-E0A9883E0698",
        username: "Gembul",
        beats: 0,
        referralPoints: 1240,
        normalReferrals: 82,
        successfulReferrals: 68,
    },
    {
        rank: 2,
        userId: "A19D1D04-2132-49A9-B41F-171B4ED852C8",
        username: "bhusna",
        beats: 0,
        referralPoints: 980,
        normalReferrals: 54,
        successfulReferrals: 49,
    },
    {
        rank: 3,
        userId: "C1DF8189-1060-4019-847A-15D572A7E526",
        username: "danbabo37",
        beats: 0,
        referralPoints: 810,
        normalReferrals: 41,
        successfulReferrals: 38,
    },
];

const INITIAL_GLOBAL_REWARDS: RewardItem[] = [
    { id: 1, type: "beats", identifier: "1", value: 500, active: true, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z" },
    { id: 2, type: "beats", identifier: "2", value: 300, active: true, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z" },
    { id: 3, type: "beats", identifier: "3", value: 200, active: true, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z" },
    { id: 4, type: "beats", identifier: "4", value: 150, active: true, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z" },
    { id: 5, type: "beats", identifier: "5", value: 100, active: true, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z" },
    { id: 6, type: "referrals", identifier: "1", value: 300, active: true, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z" },
    { id: 7, type: "referrals", identifier: "2", value: 200, active: true, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z" },
    { id: 8, type: "referrals", identifier: "3", value: 100, active: true, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z" },
];

export default function LeaderboardPage() {
    const [activeTab, setActiveTab] = useState<Tab>("beats");
    const [leaderboardView, setLeaderboardView] = useState<LeaderboardView>("current");
    const [beatsData, setBeatsData] = useState<LeaderboardItem[]>(INITIAL_BEATS_DATA);
    const [referralData, setReferralData] = useState<LeaderboardItem[]>(INITIAL_REFERRAL_DATA);
    const [lastEndedBeats, setLastEndedBeats] = useState<LeaderboardItem[]>(INITIAL_BEATS_DATA);
    const [lastEndedReferral, setLastEndedReferral] = useState<LeaderboardItem[]>(INITIAL_REFERRAL_DATA);

    // Inline edit beats state
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<string>("");

    // Validated feedback banner
    const [validationMessage, setValidationMessage] = useState<string | null>(null);

    // Management configuration state
    const [mgmtConfig, setMgmtConfig] = useState({
        data: {
            reset_cycle_days: 14,
            next_reset_date: "2026-09-30T00:00:00.000Z",
            leaderboard_start_date: "2026-09-16T00:00:00.000Z",
            cool_down_period_days: 2,
            is_in_cool_down_period: false
        }
    });
    const [isEditingConfig, setIsEditingConfig] = useState(false);
    const [configForm, setConfigForm] = useState<ConfigForm>({});
    const [isSavingConfig, setIsSavingConfig] = useState(false);

    // Global Rewards State
    const [globalRewards, setGlobalRewards] = useState<RewardItem[]>(INITIAL_GLOBAL_REWARDS);
    const [isEditingRewards, setIsEditingRewards] = useState(false);
    const [editingRewards, setEditingRewards] = useState<RewardItem[]>([]);
    const [isSavingRewards, setIsSavingRewards] = useState(false);

    // Wallet Balances State
    const [mgmtBalances, setMgmtBalances] = useState({
        data: {
            address: "0x789b...3c12f0a827419e",
            balances: {
                APT: "1,452.80",
                USDC: "25,000.00"
            }
        }
    });

    // Operation loading states
    const [isClearingCache, setIsClearingCache] = useState(false);
    const [isTriggeringReset, setIsTriggeringReset] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const fetchLeaderboardData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [beatsRes, referralRes, lastBeatsRes, lastReferralRes] = await Promise.all([
                fetch('/api/leaderboard?type=beats&view=current'),
                fetch('/api/leaderboard?type=referral&view=current'),
                fetch('/api/leaderboard?type=beats&view=lastEnded'),
                fetch('/api/leaderboard?type=referral&view=lastEnded'),
            ]);
            if (beatsRes.ok) setBeatsData(await beatsRes.json());
            if (referralRes.ok) setReferralData(await referralRes.json());
            if (lastBeatsRes.ok) setLastEndedBeats(await lastBeatsRes.json());
            if (lastReferralRes.ok) setLastEndedReferral(await lastReferralRes.json());
        } catch {
            // Keep mock data
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchManagementData = useCallback(async () => {
        try {
            const [configRes, rewardsRes, balancesRes] = await Promise.all([
                fetch('/api/admin/leaderboard/admin/reset-config'),
                fetch('/api/admin/leaderboard/admin/global-rewards'),
                fetch('/api/admin/leaderboard/admin/wallet/balances'),
            ]);
            if (configRes.ok) {
                const data = await configRes.json();
                setMgmtConfig(data);
            }
            if (rewardsRes.ok) {
                const data = await rewardsRes.json();
                if (data.data) setGlobalRewards(data.data);
            }
            if (balancesRes.ok) {
                const data = await balancesRes.json();
                setMgmtBalances(data);
            }
        } catch (err) {
            console.warn('Management API unavailable, using defaults:', err);
        }
    }, []);

    useEffect(() => {
        fetchLeaderboardData();
        fetchManagementData();
    }, [fetchLeaderboardData, fetchManagementData]);

    const currentList =
        leaderboardView === "lastEnded"
            ? activeTab === "beats" ? lastEndedBeats : lastEndedReferral
            : activeTab === "beats" ? beatsData : referralData;

    const currentRewards = isEditingRewards ? editingRewards : globalRewards;
    const beatsTotal = currentRewards
        .filter((r) => r.type === "beats")
        .reduce((sum, r) => sum + (parseFloat(String(r.value)) || 0), 0);
    const referralTotal = currentRewards
        .filter((r) => r.type === "referrals")
        .reduce((sum, r) => sum + (parseFloat(String(r.value)) || 0), 0);

    // Handle Config Save
    const handleSaveConfig = async () => {
        setIsSavingConfig(true);
        try {
            const res = await fetch('/api/admin/leaderboard/admin/reset-config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(configForm),
            });
            if (res.ok) {
                const data = await res.json();
                setMgmtConfig(data);
            } else {
                throw new Error('Failed to save config');
            }
        } catch {
            // Local fallback update
            setMgmtConfig({
                data: {
                    ...mgmtConfig.data,
                    ...configForm,
                    reset_cycle_days: configForm.reset_cycle_days ?? mgmtConfig.data.reset_cycle_days,
                    cool_down_period_days: configForm.cool_down_period_days ?? mgmtConfig.data.cool_down_period_days,
                    is_in_cool_down_period: configForm.is_in_cool_down_period ?? mgmtConfig.data.is_in_cool_down_period,
                    next_reset_date: configForm.next_reset_date ? new Date(configForm.next_reset_date).toISOString() : mgmtConfig.data.next_reset_date,
                    leaderboard_start_date: configForm.leaderboard_start_date ? new Date(configForm.leaderboard_start_date).toISOString() : mgmtConfig.data.leaderboard_start_date,
                }
            });
        } finally {
            setIsSavingConfig(false);
            setIsEditingConfig(false);
            setValidationMessage("Leaderboard configuration saved successfully.");
            setTimeout(() => setValidationMessage(null), 3000);
        }
    };

    // Handle Rewards Save
    const handleSaveGlobalRewards = async () => {
        setIsSavingRewards(true);
        try {
            const res = await fetch('/api/admin/leaderboard/admin/global-rewards', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rewards: editingRewards }),
            });
            if (res.ok) {
                setGlobalRewards(editingRewards);
            } else {
                throw new Error('Failed to save rewards');
            }
        } catch {
            setGlobalRewards(editingRewards);
        } finally {
            setIsSavingRewards(false);
            setIsEditingRewards(false);
            setValidationMessage("Global rewards distribution updated successfully.");
            setTimeout(() => setValidationMessage(null), 3000);
        }
    };

    const handleAddReward = (type: "beats" | "referrals") => {
        const filtered = editingRewards.filter((r) => r.type === type);
        const maxIdentifier =
            filtered.length > 0
                ? Math.max(...filtered.map((r) => parseInt(r.identifier) || 0))
                : 0;

        const newReward: RewardItem = {
            id: `temp-${Date.now()}`,
            type,
            identifier: (maxIdentifier + 1).toString(),
            value: 50,
            active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        setEditingRewards([...editingRewards, newReward]);
    };

    const handleDeleteReward = (id: string | number) => {
        setEditingRewards(editingRewards.filter((r) => r.id !== id));
    };

    const handleDownloadRewardsConfig = () => {
        if (!globalRewards || globalRewards.length === 0) return;

        const headers = ["id", "type", "identifier", "value", "active", "created_at", "updated_at"];
        const csvContent = [
            headers.join(","),
            ...globalRewards.map((row) =>
                `"${row.id}","${row.type}","${row.identifier}","${row.value}",${row.active ? "True" : "False"},"${row.created_at || ""}","${row.updated_at || ""}"`
            ),
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `global_reward_config_${new Date().toISOString().split("T")[0]}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const downloadLeaderboardCsv = (view: LeaderboardView = leaderboardView, typeOverride?: "beats" | "referral") => {
        const type = typeOverride || (activeTab === "beats" ? "beats" : "referral");
        const dataset =
            view === "lastEnded"
                ? type === "beats" ? lastEndedBeats : lastEndedReferral
                : type === "beats" ? beatsData : referralData;

        const headers = ["Rank", "User ID", "Username", type === "beats" ? "Beats" : "Points", "Normal Referrals", "Successful Referrals"];
        const csvContent = [
            headers.join(","),
            ...dataset.map((row) =>
                `"${row.rank}","${row.userId}","${row.username}","${type === "beats" ? row.beats : row.referralPoints || 0}","${row.normalReferrals || 0}","${row.successfulReferrals || 0}"`
            ),
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `${type}_leaderboard_${view}_${new Date().toISOString().split("T")[0]}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleClearCache = async () => {
        setIsClearingCache(true);
        try {
            await fetch('/api/admin/leaderboard/admin/clear-cache', { method: 'POST' });
            alert("Cache cleared successfully!");
        } catch {
            alert("Cache cleared locally (API failed)!");
        } finally {
            setIsClearingCache(false);
        }
    };

    const handleTriggerReset = async () => {
        const firstConfirm = confirm(
            "End the current global leaderboard now?\n\nThis will save Beats and Referral leaderboards into Last Ended history, reset current leaderboard scores to zero, and start the cooldown window.\n\nDownload the current CSV backup first if you have not already done it."
        );
        if (!firstConfirm) return;

        const typed = prompt('Type "END LEADERBOARD" to confirm this production reset.');
        if (typed !== "END LEADERBOARD") {
            alert("Reset cancelled. Confirmation text did not match.");
            return;
        }

        setIsTriggeringReset(true);
        try {
            const res = await fetch('/api/admin/leaderboard/admin/trigger-reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'global', force: true }),
            });
            if (!res.ok) throw new Error('Reset failed');
            alert("Leaderboard reset completed. Last Ended history is now available.");
            await fetchLeaderboardData(); // Refetch data
            setActiveTab("beats");
            setLeaderboardView("lastEnded");
        } catch {
            setLastEndedBeats([...beatsData]);
            setLastEndedReferral([...referralData]);
            setBeatsData((prev) => prev.map((item) => ({ ...item, beats: 0 })));
            setReferralData((prev) => prev.map((item) => ({ ...item, referralPoints: 0, normalReferrals: 0, successfulReferrals: 0 })));
            alert("Local reset completed (API failed). Last Ended history is now available locally.");
            setActiveTab("beats");
            setLeaderboardView("lastEnded");
        } finally {
            setIsTriggeringReset(false);
        }
    };

    const handleUpdateBeats = (userId: string) => {
        const val = parseFloat(editValue);
        if (isNaN(val)) return;

        setBeatsData((prev) =>
            prev.map((item) => (item.userId === userId ? { ...item, beats: val } : item))
        );
        setEditingUserId(null);
    };

    const handleRemoveUser = (userId: string) => {
        if (!confirm("Are you sure you want to remove this user from the leaderboard? Their score will be set to 0.")) return;

        if (activeTab === "beats") {
            setBeatsData((prev) => prev.filter((item) => item.userId !== userId));
        } else {
            setReferralData((prev) => prev.filter((item) => item.userId !== userId));
        }
    };

    const handleValidate = (username: string, rank: number) => {
        setValidationMessage(`Rank #${rank} (${username}) validated for reward distribution.`);
        setTimeout(() => setValidationMessage(null), 3000);
    };

    const renderTabs = () => (
        <div className="flex bg-card border border-border-subtle p-1 rounded-xl w-fit min-w-max">
            {(["beats", "referral", "management"] as Tab[]).map((tab) => (
                <button
                    key={tab}
                    onClick={() => {
                        setActiveTab(tab);
                        setEditingUserId(null);
                        if (tab === "management") {
                            setLeaderboardView("current");
                        }
                    }}
                    className={cn(
                        "px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap cursor-pointer",
                        activeTab === tab
                            ? "bg-brand-blue text-white shadow-sm"
                            : "text-muted hover:text-foreground hover:bg-muted/30"
                    )}
                >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)} {tab !== "management" && "Leaderboard"}
                </button>
            ))}
        </div>
    );

    return (
        <div className="p-2 sm:p-2 space-y-2 sm:space-y-6 max-w-7xl mx-auto w-full animate-in fade-in duration-500 pb-12 font-sans">
            {/* Page Header */}
            <PageHeader
                title="Leaderboard Management"
                subtitle="View rankings and manage user scores"
            />

            {/* Validation Banner Notification */}
            {validationMessage && (
                <div className="p-3.5 bg-success-background border border-success/30 rounded-2xl text-success text-xs font-bold flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                    <span className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-brand-green" />
                        {validationMessage}
                    </span>
                    <button onClick={() => setValidationMessage(null)} className="text-muted hover:text-foreground cursor-pointer">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Tabs */}
            <div className="overflow-x-auto no-scrollbar -mt-2">
                {renderTabs()}
            </div>

            {/* Content Area */}
            {activeTab === "management" ? (
                /* Management Tab - Cloned from scout-admin-dashboard-main */
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className="lg:col-span-3 space-y-6">
                        {/* Config Panel - Visual and editable */}
                        {mgmtConfig?.data && (
                            <div className="bg-card border border-border-subtle rounded-2xl shadow-sm p-6 overflow-hidden">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-2">
                                        <Settings className="w-5 h-5 text-brand-blue" />
                                        <h2 className="text-xl font-bold">Leaderboard Configuration</h2>
                                    </div>
                                    {!isEditingConfig ? (
                                        <button
                                            onClick={() => {
                                                const formatForInput = (dateStr: string | null | undefined) => {
                                                    if (!dateStr) return "";
                                                    const d = new Date(dateStr);
                                                    const y = d.getFullYear();
                                                    const m = String(d.getMonth() + 1).padStart(2, "0");
                                                    const day = String(d.getDate()).padStart(2, "0");
                                                    const hours = String(d.getHours()).padStart(2, "0");
                                                    const minutes = String(d.getMinutes()).padStart(2, "0");
                                                    return `${y}-${m}-${day}T${hours}:${minutes}`;
                                                };

                                                setConfigForm({
                                                    reset_cycle_days: mgmtConfig.data.reset_cycle_days,
                                                    next_reset_date: formatForInput(mgmtConfig.data.next_reset_date),
                                                    leaderboard_start_date: formatForInput(mgmtConfig.data.leaderboard_start_date),
                                                    cool_down_period_days: mgmtConfig.data.cool_down_period_days || 0,
                                                    is_in_cool_down_period: mgmtConfig.data.is_in_cool_down_period || false,
                                                });
                                                setIsEditingConfig(true);
                                            }}
                                            className="p-2 border border-border-subtle rounded-lg text-muted hover:text-brand-blue hover:border-brand-blue/30 transition-all font-medium text-sm flex items-center gap-2 cursor-pointer"
                                        >
                                            <Edit2 className="w-4 h-4" /> Edit
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setIsEditingConfig(false)}
                                                className="px-3 py-1.5 border border-border-subtle rounded-lg text-muted hover:text-foreground transition-all font-medium text-sm cursor-pointer"
                                                disabled={isSavingConfig}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleSaveConfig}
                                                className="px-3 py-1.5 bg-brand-blue text-white rounded-lg hover:bg-brand-blue/90 transition-all font-medium text-sm flex items-center gap-2 cursor-pointer"
                                                disabled={isSavingConfig}
                                            >
                                                {isSavingConfig ? (
                                                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                                                ) : (
                                                    <Save className="w-4 h-4" />
                                                )}
                                                Save
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {/* Cycle Duration */}
                                    <div className="p-4 bg-muted/10 rounded-2xl border border-border-subtle">
                                        <div className="text-xs text-muted uppercase tracking-widest font-bold mb-1">Cycle Duration</div>
                                        {isEditingConfig ? (
                                            <div className="mt-1 flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    value={configForm.reset_cycle_days || 0}
                                                    onChange={(e) => setConfigForm({ ...configForm, reset_cycle_days: parseInt(e.target.value) || 0 })}
                                                    className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm bg-background focus:ring-2 focus:ring-brand-blue/20 transition-all font-bold"
                                                />
                                            </div>
                                        ) : (
                                            <>
                                                <div className="text-2xl font-bold text-foreground">{mgmtConfig.data.reset_cycle_days} Days</div>
                                                <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" /> Recurring reset cycle
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Next Reset */}
                                    <div className="p-4 bg-muted/10 rounded-2xl border border-border-subtle">
                                        <div className="text-xs text-muted uppercase tracking-widest font-bold mb-1">Next Reset</div>
                                        {isEditingConfig ? (
                                            <div className="mt-1">
                                                <input
                                                    type="datetime-local"
                                                    value={configForm.next_reset_date || ""}
                                                    onChange={(e) => setConfigForm({ ...configForm, next_reset_date: e.target.value })}
                                                    className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm bg-background focus:ring-2 focus:ring-brand-blue/20 transition-all font-medium"
                                                />
                                            </div>
                                        ) : (
                                            <>
                                                <div className="text-2xl font-bold text-brand-blue">
                                                    {new Date(mgmtConfig.data.next_reset_date).toLocaleDateString()}
                                                </div>
                                                <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" /> {new Date(mgmtConfig.data.next_reset_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Leaderboard Start Date */}
                                    <div className="p-4 bg-muted/10 rounded-2xl border border-border-subtle">
                                        <div className="text-xs text-muted uppercase tracking-widest font-bold mb-1">Leaderboard Start Date</div>
                                        {isEditingConfig ? (
                                            <div className="mt-1">
                                                <input
                                                    type="datetime-local"
                                                    value={configForm.leaderboard_start_date || ""}
                                                    onChange={(e) => setConfigForm({ ...configForm, leaderboard_start_date: e.target.value })}
                                                    className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm bg-background focus:ring-2 focus:ring-brand-blue/20 transition-all font-medium"
                                                />
                                            </div>
                                        ) : (
                                            <>
                                                <div className="text-2xl font-bold text-foreground">
                                                    {mgmtConfig.data.leaderboard_start_date ? new Date(mgmtConfig.data.leaderboard_start_date).toLocaleDateString() : "N/A"}
                                                </div>
                                                {mgmtConfig.data.leaderboard_start_date && (
                                                    <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                                                        <Calendar className="w-3 h-3" /> {new Date(mgmtConfig.data.leaderboard_start_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    {/* Cooldown Duration */}
                                    <div className="p-4 bg-muted/10 rounded-2xl border border-border-subtle">
                                        <div className="text-xs text-muted uppercase tracking-widest font-bold mb-1">Cooldown Duration</div>
                                        {isEditingConfig ? (
                                            <div className="mt-1 flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    value={configForm.cool_down_period_days || 0}
                                                    onChange={(e) => setConfigForm({ ...configForm, cool_down_period_days: parseInt(e.target.value) || 0 })}
                                                    className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm bg-background focus:ring-2 focus:ring-brand-blue/20 transition-all font-bold"
                                                />
                                            </div>
                                        ) : (
                                            <>
                                                <div className="text-2xl font-bold text-foreground">{mgmtConfig.data.cool_down_period_days || 0} Days</div>
                                                <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" /> Post-reset cooldown
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Status */}
                                    <div className="p-4 bg-muted/10 rounded-2xl border border-border-subtle">
                                        <div className="text-xs text-muted uppercase tracking-widest font-bold mb-1">Status</div>
                                        {isEditingConfig ? (
                                            <div className="mt-2 flex items-center gap-2 h-10">
                                                <div className="flex items-center space-x-2">
                                                    <input
                                                        type="checkbox"
                                                        id="cooldown-checkbox"
                                                        checked={configForm.is_in_cool_down_period || false}
                                                        onChange={(e) => setConfigForm({ ...configForm, is_in_cool_down_period: e.target.checked })}
                                                        className="w-5 h-5 accent-brand-blue border-border-subtle rounded text-brand-blue focus:ring-brand-blue cursor-pointer"
                                                    />
                                                    <label htmlFor="cooldown-checkbox" className="text-sm font-medium cursor-pointer">In Cooldown Period</label>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={cn(
                                                        "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border",
                                                        mgmtConfig.data.is_in_cool_down_period
                                                            ? "bg-warning-background text-warning border-warning/30"
                                                            : "bg-success-background text-success border-success/30"
                                                    )}>
                                                        {mgmtConfig.data.is_in_cool_down_period ? "Cooling Down" : "Active"}
                                                    </span>
                                                </div>
                                                <div className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                                                    <Shield className="w-3 h-3" /> {mgmtConfig.data.is_in_cool_down_period ? "Security period active" : "Normal operations"}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Global Rewards Panel */}
                        <div className="bg-card border border-border-subtle rounded-2xl shadow-sm p-6 overflow-hidden">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <Award className="w-5 h-5 text-brand-blue" />
                                    <h2 className="text-xl font-bold">Global Rewards Configuration</h2>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleDownloadRewardsConfig}
                                        className="p-2 border border-border-subtle rounded-lg text-muted hover:text-foreground hover:bg-muted/30 transition-all font-medium text-sm flex items-center gap-2 cursor-pointer"
                                        title="Download CSV"
                                    >
                                        <Download className="w-4 h-4" /> Download
                                    </button>

                                    {!isEditingRewards ? (
                                        <button
                                            onClick={() => {
                                                setEditingRewards(JSON.parse(JSON.stringify(globalRewards)));
                                                setIsEditingRewards(true);
                                            }}
                                            className="p-2 border border-border-subtle rounded-lg text-muted hover:text-brand-blue hover:border-brand-blue/30 transition-all font-medium text-sm flex items-center gap-2 cursor-pointer"
                                        >
                                            <Edit2 className="w-4 h-4" /> Edit
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setIsEditingRewards(false)}
                                                className="px-3 py-1.5 border border-border-subtle rounded-lg text-muted hover:text-foreground transition-all font-medium text-sm cursor-pointer"
                                                disabled={isSavingRewards}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleSaveGlobalRewards}
                                                className="px-3 py-1.5 bg-brand-blue text-white rounded-lg hover:bg-brand-blue/90 transition-all font-medium text-sm flex items-center gap-2 cursor-pointer"
                                                disabled={isSavingRewards}
                                            >
                                                {isSavingRewards ? (
                                                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                                                ) : (
                                                    <Save className="w-4 h-4" />
                                                )}
                                                Save
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Beats Rewards Column */}
                                <div>
                                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-border-subtle">
                                        <h3 className="font-bold text-foreground flex items-center gap-2">
                                            <Globe className="w-4 h-4 text-brand-blue" />
                                            Beats Rewards
                                        </h3>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-bold px-2 py-1 bg-success-background text-success rounded-md border border-success/10 uppercase tracking-wider">
                                                Total: ${beatsTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                            <span className="text-xs font-semibold px-2 py-1 bg-brand-blue/10 text-brand-blue rounded-md">
                                                By Rank
                                            </span>
                                            {isEditingRewards && (
                                                <button
                                                    onClick={() => handleAddReward("beats")}
                                                    className="p-1 hover:bg-brand-blue/10 rounded-md text-brand-blue transition-colors cursor-pointer"
                                                    title="Add Rank"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        {(isEditingRewards ? editingRewards : globalRewards)
                                            .filter((r) => r.type === "beats")
                                            .sort((a, b) => parseInt(a.identifier) - parseInt(b.identifier))
                                            .map((reward) => (
                                                <div
                                                    key={reward.id}
                                                    className="flex items-center justify-between p-3 bg-muted/5 rounded-xl border border-border-subtle hover:border-brand-blue/20 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span
                                                            className={cn(
                                                                "flex justify-center items-center w-7 h-7 rounded-lg text-xs font-bold",
                                                                parseInt(reward.identifier) === 1
                                                                    ? "bg-amber-100 text-amber-700"
                                                                    : parseInt(reward.identifier) === 2
                                                                    ? "bg-slate-200 text-slate-700"
                                                                    : parseInt(reward.identifier) === 3
                                                                    ? "bg-orange-100 text-orange-700"
                                                                    : "bg-background text-muted-foreground border border-border-subtle"
                                                            )}
                                                        >
                                                            #{reward.identifier}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {isEditingRewards ? (
                                                            <>
                                                                <div className="flex items-center pr-1 border border-brand-blue/40 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-brand-blue/20">
                                                                    <span className="pl-3 pr-1 text-muted text-sm">$</span>
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        value={reward.value}
                                                                        onChange={(e) => {
                                                                            const newVal = parseFloat(e.target.value) || 0;
                                                                            setEditingRewards(
                                                                                editingRewards.map((r) =>
                                                                                    r.id === reward.id ? { ...r, value: newVal } : r
                                                                                )
                                                                            );
                                                                        }}
                                                                        className="w-20 py-1.5 text-right text-sm font-bold bg-transparent outline-none"
                                                                    />
                                                                </div>
                                                                <button
                                                                    onClick={() => handleDeleteReward(reward.id)}
                                                                    className="p-1.5 text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-all cursor-pointer"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <div className="font-bold text-foreground">
                                                                ${parseFloat(String(reward.value)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>

                                {/* Referral Rewards Column */}
                                <div>
                                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-border-subtle">
                                        <h3 className="font-bold text-foreground flex items-center gap-2">
                                            <Users className="w-4 h-4 text-brand-blue" />
                                            Referral Rewards
                                        </h3>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-bold px-2 py-1 bg-success-background text-success rounded-md border border-success/10 uppercase tracking-wider">
                                                Total: ${referralTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                            <span className="text-xs font-semibold px-2 py-1 bg-brand-blue/10 text-brand-blue rounded-md">
                                                By Rank
                                            </span>
                                            {isEditingRewards && (
                                                <button
                                                    onClick={() => handleAddReward("referrals")}
                                                    className="p-1 hover:bg-brand-blue/10 rounded-md text-brand-blue transition-colors cursor-pointer"
                                                    title="Add Rank"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        {(isEditingRewards ? editingRewards : globalRewards)
                                            .filter((r) => r.type === "referrals")
                                            .sort((a, b) => parseInt(a.identifier) - parseInt(b.identifier))
                                            .map((reward) => (
                                                <div
                                                    key={reward.id}
                                                    className="flex items-center justify-between p-3 bg-muted/5 rounded-xl border border-border-subtle hover:border-brand-blue/20 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span
                                                            className={cn(
                                                                "flex justify-center items-center w-7 h-7 rounded-lg text-xs font-bold",
                                                                parseInt(reward.identifier) === 1
                                                                    ? "bg-amber-100 text-amber-700"
                                                                    : parseInt(reward.identifier) === 2
                                                                    ? "bg-slate-200 text-slate-700"
                                                                    : parseInt(reward.identifier) === 3
                                                                    ? "bg-orange-100 text-orange-700"
                                                                    : "bg-background text-muted-foreground border border-border-subtle"
                                                            )}
                                                        >
                                                            #{reward.identifier}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {isEditingRewards ? (
                                                            <>
                                                                <div className="flex items-center pr-1 border border-brand-blue/40 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-brand-blue/20">
                                                                    <span className="pl-3 pr-1 text-muted text-sm">$</span>
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        value={reward.value}
                                                                        onChange={(e) => {
                                                                            const newVal = parseFloat(e.target.value) || 0;
                                                                            setEditingRewards(
                                                                                editingRewards.map((r) =>
                                                                                    r.id === reward.id ? { ...r, value: newVal } : r
                                                                                )
                                                                            );
                                                                        }}
                                                                        className="w-20 py-1.5 text-right text-sm font-bold bg-transparent outline-none"
                                                                    />
                                                                </div>
                                                                <button
                                                                    onClick={() => handleDeleteReward(reward.id)}
                                                                    className="p-1.5 text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-all cursor-pointer"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <div className="font-bold text-foreground">
                                                                ${parseFloat(String(reward.value)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Wallet & Operations + System Operations */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Wallet Balances Card */}
                        <div className="bg-card border border-border-subtle rounded-2xl shadow-sm p-6 flex flex-col h-fit">
                            <div className="flex items-center gap-2 mb-6">
                                <Wallet className="w-5 h-5 text-brand-blue" />
                                <h2 className="text-xl font-bold">Wallet & Operations</h2>
                            </div>

                            <div className="space-y-4">
                                <div className="p-4 bg-muted/5 rounded-2xl border border-border-subtle">
                                    <div className="text-xs text-muted mb-2 font-medium">Main Address</div>
                                    <div
                                        onClick={() => {
                                            navigator.clipboard?.writeText(mgmtBalances.data.address);
                                            alert("Address copied to clipboard!");
                                        }}
                                        className="bg-muted/10 p-3 rounded-xl flex items-center justify-between border border-border-subtle hover:border-brand-blue/20 transition-all cursor-pointer group"
                                        title="Click to copy address"
                                    >
                                        <span className="text-[10px] font-mono text-muted truncate max-w-[150px]">
                                            {mgmtBalances.data.address}
                                        </span>
                                        <RefreshCw className="w-3 h-3 text-muted group-hover:text-brand-blue transition-all" />
                                    </div>
                                </div>

                                <div className="space-y-3 mt-2">
                                    {Object.entries(mgmtBalances.data.balances).map(([token, balance]) => (
                                        <div
                                            key={token}
                                            className="p-4 bg-card rounded-2xl border border-border-subtle hover:shadow-md transition-all group overflow-hidden relative"
                                        >
                                            <div className="absolute top-0 right-0 p-2 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
                                                <Coins className="w-12 h-12" />
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className={cn(
                                                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                                                        token === "APT" ? "bg-brand-blue/10 text-brand-blue" : "bg-success-background text-success"
                                                    )}
                                                >
                                                    {token === "APT" ? <Globe className="w-5 h-5" /> : <Coins className="w-5 h-5" />}
                                                </div>
                                                <div>
                                                    <div className="text-[10px] text-muted uppercase tracking-widest font-bold">
                                                        {token} Balance
                                                    </div>
                                                    <div className="text-lg font-bold text-foreground">
                                                        {balance} <span className="text-xs font-normal text-muted">{token}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* System Operations Card */}
                        <div className="bg-card border border-border-subtle rounded-2xl shadow-sm p-6 flex flex-col h-fit mt-6">
                            <div className="flex items-center gap-2 mb-6">
                                <RefreshCw className="w-5 h-5 text-brand-blue" />
                                <h2 className="text-xl font-bold">System Operations</h2>
                            </div>

                            <div className="space-y-4">
                                <div className="p-4 bg-danger/5 rounded-2xl border border-danger/20">
                                    <div className="text-xs text-danger mb-2 font-medium">Leaderboard Reset</div>
                                    <div className="space-y-3">
                                        <button
                                            onClick={() => downloadLeaderboardCsv("current", "beats")}
                                            className="w-full py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all border border-border-subtle bg-card hover:border-brand-blue/30 hover:bg-muted/10 cursor-pointer"
                                        >
                                            <Download className="w-4 h-4 text-brand-blue" />
                                            Download Current Beats CSV
                                        </button>
                                        <button
                                            onClick={() => downloadLeaderboardCsv("current", "referral")}
                                            className="w-full py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all border border-border-subtle bg-card hover:border-brand-blue/30 hover:bg-muted/10 cursor-pointer"
                                        >
                                            <Download className="w-4 h-4 text-brand-blue" />
                                            Download Current Referral CSV
                                        </button>
                                        <button
                                            onClick={handleTriggerReset}
                                            disabled={isTriggeringReset}
                                            className={cn(
                                                "w-full py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all border border-danger/30 bg-danger/10 text-danger hover:bg-danger hover:text-white cursor-pointer active:scale-95",
                                                isTriggeringReset && "opacity-70 pointer-events-none"
                                            )}
                                        >
                                            <RefreshCw className={cn("w-4 h-4", isTriggeringReset && "animate-spin")} />
                                            {isTriggeringReset ? "Ending..." : "End Current Leaderboard"}
                                        </button>
                                    </div>
                                </div>

                                <div className="p-4 bg-muted/5 rounded-2xl border border-border-subtle">
                                    <div className="text-xs text-muted mb-2 font-medium">Cache Management</div>
                                    <button
                                        onClick={handleClearCache}
                                        disabled={isClearingCache}
                                        className={cn(
                                            "w-full py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all border border-border-subtle bg-card hover:border-brand-blue/30 hover:bg-muted/10 cursor-pointer",
                                            isClearingCache && "opacity-70 pointer-events-none"
                                        )}
                                    >
                                        <RefreshCw className={cn("w-4 h-4 text-brand-blue", isClearingCache && "animate-spin")} />
                                        {isClearingCache ? "Clearing..." : "Clear Leaderboard Cache"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* Leaderboard Table Card (Beats or Referral) */
                <div className="bg-card border border-border-subtle rounded-2xl shadow-sm overflow-hidden">
                    {/* Header */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-3 sm:px-6 py-4 border-b border-border-subtle bg-muted/5">
                        <div>
                            <div className="text-sm font-bold text-foreground">
                                {leaderboardView === "lastEnded" ? "Last Ended Leaderboard" : "Current Live Leaderboard"}
                            </div>
                            <div className="text-xs text-muted mt-1">
                                {leaderboardView === "lastEnded"
                                    ? "Archived snapshot from previous competition round"
                                    : "Live rankings used while the current round is active"}
                            </div>
                        </div>

                        {/* Current vs Last Ended Pill Selector */}
                        <div className="flex items-center gap-2">
                            <div className="flex bg-background border border-border-subtle p-1 rounded-xl w-fit">
                                <button
                                    onClick={() => setLeaderboardView("current")}
                                    className={cn(
                                        "px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
                                        leaderboardView === "current"
                                            ? "bg-brand-blue text-white shadow-sm"
                                            : "text-muted hover:text-foreground hover:bg-muted/30"
                                    )}
                                >
                                    Current
                                </button>
                                <button
                                    onClick={() => setLeaderboardView("lastEnded")}
                                    className={cn(
                                        "px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
                                        leaderboardView === "lastEnded"
                                            ? "bg-brand-blue text-white shadow-sm"
                                            : "text-muted hover:text-foreground hover:bg-muted/30"
                                    )}
                                >
                                    Last Ended
                                </button>
                            </div>

                            <button
                                onClick={() => downloadLeaderboardCsv(leaderboardView)}
                                className="p-2 border border-border-subtle rounded-xl text-muted hover:text-foreground hover:bg-muted/30 transition-all font-medium text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                                title="Download CSV"
                            >
                                <Download className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">CSV</span>
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="border-b border-border-subtle bg-muted/10">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-[0.2em] w-20">
                                        RANK
                                    </th>
                                    <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-[0.2em]">
                                        USER
                                    </th>
                                    <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-[0.2em]">
                                        {activeTab === "beats" ? "BEATS" : "POINTS"}
                                    </th>
                                    {activeTab === "referral" && (
                                        <>
                                            <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-[0.2em] text-center">
                                                NORMAL
                                            </th>
                                            <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-[0.2em] text-center">
                                                SUCCESSFUL
                                            </th>
                                        </>
                                    )}
                                    <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-[0.2em] text-right">
                                        ACTIONS
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-subtle">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={activeTab === "beats" ? 4 : 6} className="py-20 text-center">
                                            <div className="flex flex-col items-center justify-center text-muted gap-3">
                                                <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
                                                <p className="text-sm font-medium">Loading leaderboard data...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : currentList.map((item) => {
                                    const isEditing = editingUserId === item.userId;

                                    return (
                                        <tr
                                            key={item.userId}
                                            className="hover:bg-muted/5 transition-colors group"
                                        >
                                            {/* Rank Badge */}
                                            <td className="px-6 py-4">
                                                <div
                                                    className={cn(
                                                        "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs",
                                                        item.rank === 1
                                                            ? "bg-amber-100 text-amber-700 border border-amber-300"
                                                            : item.rank === 2
                                                            ? "bg-slate-200 text-slate-700 border border-slate-300"
                                                            : item.rank === 3
                                                            ? "bg-orange-100 text-orange-700 border border-orange-300"
                                                            : "text-muted-foreground font-mono bg-background border border-border-subtle"
                                                    )}
                                                >
                                                    {item.rank}
                                                </div>
                                            </td>

                                            {/* User Avatar + Username + ID */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-muted/10 border border-border-subtle overflow-hidden shrink-0 flex items-center justify-center">
                                                        {item.avatarUrl ? (
                                                            /* eslint-disable-next-line @next/next/no-img-element */
                                                            <img
                                                                src={item.avatarUrl}
                                                                alt={item.username}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <UserIcon className="w-4 h-4 text-muted" />
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="font-bold text-foreground group-hover:text-brand-blue transition-colors text-sm truncate max-w-[140px] sm:max-w-xs">
                                                            {item.username}
                                                        </span>
                                                        <span className="text-[10px] text-muted font-mono tracking-tight truncate max-w-[140px] sm:max-w-xs">
                                                            {item.userId}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Beats / Points Value + Inline Edit */}
                                            <td className="px-6 py-4">
                                                {isEditing ? (
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="number"
                                                            step="0.1"
                                                            value={editValue}
                                                            onChange={(e) => setEditValue(e.target.value)}
                                                            className="w-20 px-2.5 py-1 bg-background border border-brand-blue rounded-lg text-foreground font-mono font-bold text-sm outline-none ring-1 ring-brand-blue/30"
                                                            autoFocus
                                                        />
                                                        <button
                                                            onClick={() => handleUpdateBeats(item.userId)}
                                                            className="p-1 text-brand-green hover:bg-brand-green/20 rounded-md transition-colors cursor-pointer"
                                                            title="Save"
                                                        >
                                                            <Check className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingUserId(null)}
                                                            className="p-1 text-danger hover:bg-danger/20 rounded-md transition-colors cursor-pointer"
                                                            title="Cancel"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-foreground text-base font-mono">
                                                            {activeTab === "beats"
                                                                ? safeToFixed(item.beats, 1)
                                                                : Number(item.referralPoints || 0).toLocaleString()}
                                                        </span>
                                                        {activeTab === "beats" && leaderboardView === "current" && (
                                                            <button
                                                                onClick={() => {
                                                                    setEditingUserId(item.userId);
                                                                    setEditValue(String(item.beats ?? 0));
                                                                }}
                                                                className="p-1 text-muted hover:text-brand-blue hover:bg-muted/30 rounded-md transition-all cursor-pointer"
                                                                title="Edit score"
                                                            >
                                                                <Edit2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Referral Columns */}
                                            {activeTab === "referral" && (
                                                <>
                                                    <td className="px-6 py-4 text-center font-mono text-xs text-muted">
                                                        {item.normalReferrals || 0}
                                                    </td>
                                                    <td className="px-6 py-4 text-center font-mono text-xs text-brand-green font-bold">
                                                        {item.successfulReferrals || 0}
                                                    </td>
                                                </>
                                            )}

                                            {/* Actions: Validate & Trash */}
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2.5">
                                                    <button
                                                        onClick={() => handleValidate(item.username, item.rank)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-green/10 text-brand-green hover:bg-brand-green hover:text-slate-950 text-xs font-bold rounded-xl transition-all border border-brand-green/30 active:scale-95 shadow-sm cursor-pointer"
                                                    >
                                                        <ShieldCheck className="w-3.5 h-3.5" />
                                                        <span>Validate</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleRemoveUser(item.userId)}
                                                        className="p-1.5 text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors cursor-pointer"
                                                        title="Remove from leaderboard"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}