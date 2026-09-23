"use client";

import React, { useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import {
    Check,
    X,
    Trash2,
    // Settings,
    // Clock,
    Download,
    ShieldCheck,
    Edit2,
    User as UserIcon,
    // Wallet,
    CheckCircle2,
    // Calendar,
    // Award,
    // Globe,
    // Users,
    // Plus,
    // Save,
    // Coins,
    // RefreshCw,
    // Shield
} from "lucide-react";
import { cn } from "@/lib/utils";

// type Tab = "beats" | "referral" | "management";
type Tab = "beats" | "referral";
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

/*
interface RewardItem {
    id: string | number;
    type: "beats" | "referrals";
    identifier: string;
    value: number;
    active: boolean;
    created_at?: string;
    updated_at?: string;
}
*/

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

/*
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
*/

export default function LeaderboardPage() {
    const [activeTab, setActiveTab] = useState<Tab>("beats");
    const [leaderboardView, setLeaderboardView] = useState<LeaderboardView>("current");
    const [beatsData, setBeatsData] = useState<LeaderboardItem[]>(INITIAL_BEATS_DATA);
    const [referralData, setReferralData] = useState<LeaderboardItem[]>(INITIAL_REFERRAL_DATA);
    const [lastEndedBeats] = useState<LeaderboardItem[]>(INITIAL_BEATS_DATA);
    const [lastEndedReferral] = useState<LeaderboardItem[]>(INITIAL_REFERRAL_DATA);

    // Inline edit beats state
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<string>("");

    // Validated feedback banner
    const [validationMessage, setValidationMessage] = useState<string | null>(null);

    /*
    interface ConfigForm {
        reset_cycle_days?: number;
        next_reset_date?: string;
        leaderboard_start_date?: string;
        cool_down_period_days?: number;
        is_in_cool_down_period?: boolean;
    }

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
    const [mgmtBalances] = useState({
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
    */

    const currentList =
        leaderboardView === "lastEnded"
            ? activeTab === "beats" ? lastEndedBeats : lastEndedReferral
            : activeTab === "beats" ? beatsData : referralData;

    /*
    const currentRewards = isEditingRewards ? editingRewards : globalRewards;
    const beatsTotal = currentRewards
        .filter((r) => r.type === "beats")
        .reduce((sum, r) => sum + (parseFloat(String(r.value)) || 0), 0);
    const referralTotal = currentRewards
        .filter((r) => r.type === "referrals")
        .reduce((sum, r) => sum + (parseFloat(String(r.value)) || 0), 0);

    // Handle Config Save
    const handleSaveConfig = () => {
        setIsSavingConfig(true);
        setTimeout(() => {
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
            setIsSavingConfig(false);
            setIsEditingConfig(false);
            setValidationMessage("Leaderboard configuration saved successfully.");
            setTimeout(() => setValidationMessage(null), 3000);
        }, 500);
    };

    // Handle Rewards Save
    const handleSaveGlobalRewards = () => {
        setIsSavingRewards(true);
        setTimeout(() => {
            setGlobalRewards(editingRewards);
            setIsSavingRewards(false);
            setIsEditingRewards(false);
            setValidationMessage("Global rewards distribution updated successfully.");
            setTimeout(() => setValidationMessage(null), 3000);
        }, 500);
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

    const handleClearCache = () => {
        setIsClearingCache(true);
        setTimeout(() => {
            setIsClearingCache(false);
            alert("Cache cleared successfully!");
        }, 600);
    };

    const handleTriggerReset = () => {
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
        setTimeout(() => {
            setLastEndedBeats([...beatsData]);
            setLastEndedReferral([...referralData]);
            setBeatsData((prev) => prev.map((item) => ({ ...item, beats: 0 })));
            setReferralData((prev) => prev.map((item) => ({ ...item, referralPoints: 0, normalReferrals: 0, successfulReferrals: 0 })));
            setIsTriggeringReset(false);
            alert("Leaderboard reset completed. Last Ended history is now available.");
            setActiveTab("beats");
            setLeaderboardView("lastEnded");
        }, 800);
    };
    */

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
            {(["beats", "referral"] as Tab[]).map((tab) => (
                <button
                    key={tab}
                    onClick={() => {
                        setActiveTab(tab);
                        setEditingUserId(null);
                    }}
                    className={cn(
                        "px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap cursor-pointer",
                        activeTab === tab
                            ? "bg-brand-blue text-white shadow-sm"
                            : "text-muted hover:text-foreground hover:bg-muted/30"
                    )}
                >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)} Leaderboard
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

            {/* Leaderboard Table Card (Beats or Referral) */}
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
                            {currentList.map((item) => {
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
                                                            ? item.beats.toFixed(1)
                                                            : item.referralPoints?.toLocaleString() || "0"}
                                                    </span>
                                                    {activeTab === "beats" && leaderboardView === "current" && (
                                                        <button
                                                            onClick={() => {
                                                                setEditingUserId(item.userId);
                                                                setEditValue(item.beats.toString());
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

            {/* 
            MANAGEMENT TAB CONTENT (COMMENTED OUT):
            {activeTab === "management" && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className="lg:col-span-3 space-y-6">
                        ... Leaderboard Configuration & Global Rewards Configuration ...
                    </div>
                    <div className="lg:col-span-1 space-y-6">
                        ... Wallet Balances & System Operations ...
                    </div>
                </div>
            )}
            */}
        </div>
    );
}