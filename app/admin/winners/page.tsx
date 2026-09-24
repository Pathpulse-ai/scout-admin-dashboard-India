"use client";

import React, { useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import {
    Trophy,
    Download,
    Coins,
    Search,
    Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

interface WinnerRecord {
    id: string;
    rank: number;
    username: string;
    userId: string;
    rewardAmount: number;
    token: string;
    round: string;
    status: "distributed" | "pending";
    date: string;
}

const MOCK_WINNERS: WinnerRecord[] = [
    {
        id: "WIN-101",
        rank: 1,
        username: "Gembul",
        userId: "B8B1382A-EE8A-4A0D-831F-E0A9883E0698",
        rewardAmount: 500,
        token: "USDC",
        round: "Cycle #18 (Global Beats)",
        status: "distributed",
        date: "2026-09-15"
    },
    {
        id: "WIN-102",
        rank: 2,
        username: "bhusna",
        userId: "A19D1D04-2132-49A9-B41F-171B4ED852C8",
        rewardAmount: 300,
        token: "USDC",
        round: "Cycle #18 (Global Beats)",
        status: "distributed",
        date: "2026-09-15"
    },
    {
        id: "WIN-103",
        rank: 3,
        username: "scout_76672",
        userId: "2A594844-CC0C-4F74-B364-1541DF10EC84",
        rewardAmount: 200,
        token: "USDC",
        round: "Cycle #18 (Global Beats)",
        status: "distributed",
        date: "2026-09-15"
    },
    {
        id: "WIN-104",
        rank: 1,
        username: "danbabo37",
        userId: "C1DF8189-1060-4019-847A-15D572A7E526",
        rewardAmount: 300,
        token: "USDC",
        round: "Cycle #18 (Referral Rewards)",
        status: "pending",
        date: "2026-09-15"
    },
];

export default function WinnersPage() {
    const [searchQuery, setSearchQuery] = useState("");

    const filtered = MOCK_WINNERS.filter(
        (w) =>
            w.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
            w.round.toLowerCase().includes(searchQuery.toLowerCase()) ||
            w.userId.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleDownloadCSV = () => {
        const headers = ["ID", "Rank", "Username", "User ID", "Reward Amount", "Token", "Round", "Status", "Date"];
        const rows = filtered.map((w) =>
            `"${w.id}","${w.rank}","${w.username}","${w.userId}","${w.rewardAmount}","${w.token}","${w.round}","${w.status}","${w.date}"`
        );
        const csvContent = [headers.join(","), ...rows].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `winners_report_${new Date().toISOString().split("T")[0]}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-500 font-sans">
            <PageHeader
                title="Winners Management"
                subtitle="Validate and audit leaderboard winner payouts"
                actions={
                    <button
                        onClick={handleDownloadCSV}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-card border border-border-subtle text-xs font-bold text-muted hover:text-brand-blue hover:border-brand-blue/30 transition-all shadow-sm cursor-pointer"
                    >
                        <Download className="w-4 h-4 text-brand-green" />
                        Export CSV
                    </button>
                }
            />

            {/* Quick Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-card border border-border-subtle p-5 rounded-2xl shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-brand-green/10 text-brand-green flex items-center justify-center">
                        <Trophy className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-muted uppercase tracking-widest">Total Winners</div>
                        <div className="text-2xl font-black text-foreground">1,248</div>
                    </div>
                </div>

                <div className="bg-card border border-border-subtle p-5 rounded-2xl shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-success-background text-success flex items-center justify-center">
                        <Coins className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-muted uppercase tracking-widest">Total Distributed</div>
                        <div className="text-2xl font-black text-foreground">$124,500.00</div>
                    </div>
                </div>

                <div className="bg-card border border-border-subtle p-5 rounded-2xl shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-warning-background text-warning flex items-center justify-center">
                        <Clock className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-muted uppercase tracking-widest">Pending Payouts</div>
                        <div className="text-2xl font-black text-warning">14 Records</div>
                    </div>
                </div>
            </div>

            {/* Winners Table */}
            <div className="bg-card border border-border-subtle rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/5">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Filter winners by name, round..."
                            className="w-full bg-background border border-border-subtle rounded-xl pl-9 pr-3 py-1.5 text-xs text-foreground outline-none focus:border-brand-blue"
                        />
                    </div>
                    <span className="text-xs font-bold text-muted">
                        Showing {filtered.length} of {MOCK_WINNERS.length} winners
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="border-b border-border-subtle bg-muted/10">
                            <tr>
                                <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-widest w-20">Rank</th>
                                <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-widest">Winner</th>
                                <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-widest">Reward</th>
                                <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-widest">Round Event</th>
                                <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-widest text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle">
                            {filtered.map((item) => (
                                <tr key={item.id} className="hover:bg-muted/5 transition-colors">
                                    <td className="px-6 py-4">
                                        <div
                                            className={cn(
                                                "w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs",
                                                item.rank === 1
                                                    ? "bg-amber-100 text-amber-700"
                                                    : item.rank === 2
                                                    ? "bg-slate-200 text-slate-700"
                                                    : item.rank === 3
                                                    ? "bg-orange-100 text-orange-700"
                                                    : "bg-background text-muted-foreground border border-border-subtle"
                                            )}
                                        >
                                            #{item.rank}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-foreground text-sm">{item.username}</span>
                                            <span className="text-[10px] text-muted font-mono">{item.userId}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-black text-foreground text-sm font-mono">
                                            ${item.rewardAmount.toFixed(2)} <span className="text-xs text-brand-green">{item.token}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-xs font-medium text-muted">
                                        {item.round}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span
                                            className={cn(
                                                "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                                                item.status === "distributed"
                                                    ? "bg-success-background text-success border-success/30"
                                                    : "bg-warning-background text-warning border-warning/30"
                                            )}
                                        >
                                            {item.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
