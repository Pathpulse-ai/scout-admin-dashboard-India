"use client";

import React, { useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import {
    Wallet,
    Send,
    CheckCircle2,
    Coins,
    Globe
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PayoutEntry {
    rank: number;
    username: string;
    walletAddress: string;
    amount: number;
    token: "USDC" | "APT";
    status: "ready" | "sent";
}

const MOCK_PAYOUTS: PayoutEntry[] = [
    {
        rank: 1,
        username: "Gembul",
        walletAddress: "0x789b...3c12f0",
        amount: 500,
        token: "USDC",
        status: "ready"
    },
    {
        rank: 2,
        username: "bhusna",
        walletAddress: "0x442a...9811ea",
        amount: 300,
        token: "USDC",
        status: "ready"
    },
    {
        rank: 3,
        username: "scout_76672",
        walletAddress: "0x918f...20aa45",
        amount: 200,
        token: "USDC",
        status: "ready"
    }
];

export default function RewardsPage() {
    const [payouts, setPayouts] = useState<PayoutEntry[]>(MOCK_PAYOUTS);
    const [isDistributing, setIsDistributing] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    const totalBatch = payouts.reduce((sum, p) => sum + p.amount, 0);

    const handleDistributeAll = () => {
        setIsDistributing(true);
        setTimeout(() => {
            setPayouts((prev) => prev.map((p) => ({ ...p, status: "sent" })));
            setIsDistributing(false);
            setStatusMessage(`Successfully distributed $${totalBatch.toFixed(2)} USDC to ${payouts.length} recipients.`);
            setTimeout(() => setStatusMessage(null), 4000);
        }, 1200);
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-500 font-sans">
            <PageHeader
                title="Rewards Distribution"
                subtitle="Execute automated or batch smart contract token payouts"
            />

            {statusMessage && (
                <div className="p-4 bg-success-background border border-success/30 rounded-2xl text-success text-sm font-bold flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-5 h-5 text-brand-green" />
                    {statusMessage}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Distribution Queue */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-card border border-border-subtle rounded-3xl p-6 shadow-sm space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-4">
                            <div>
                                <h3 className="text-base font-bold text-foreground">Current Distribution Queue</h3>
                                <p className="text-xs text-muted">Ready for on-chain execution via Treasury</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleDistributeAll}
                                    disabled={isDistributing || payouts.every((p) => p.status === "sent")}
                                    className={cn(
                                        "px-4 py-2.5 rounded-xl bg-brand-green text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm cursor-pointer active:scale-95",
                                        (isDistributing || payouts.every((p) => p.status === "sent")) && "opacity-50 pointer-events-none"
                                    )}
                                >
                                    <Send className={cn("w-3.5 h-3.5", isDistributing && "animate-spin")} />
                                    {isDistributing ? "Sending..." : "Execute Payouts"}
                                </button>
                            </div>
                        </div>

                        {/* Queue Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="border-b border-border-subtle bg-muted/10">
                                    <tr>
                                        <th className="px-4 py-3 text-[10px] font-black text-muted uppercase tracking-widest">Rank</th>
                                        <th className="px-4 py-3 text-[10px] font-black text-muted uppercase tracking-widest">Recipient</th>
                                        <th className="px-4 py-3 text-[10px] font-black text-muted uppercase tracking-widest">Wallet</th>
                                        <th className="px-4 py-3 text-[10px] font-black text-muted uppercase tracking-widest">Reward</th>
                                        <th className="px-4 py-3 text-[10px] font-black text-muted uppercase tracking-widest text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-subtle">
                                    {payouts.map((item) => (
                                        <tr key={item.rank} className="hover:bg-muted/5 transition-colors">
                                            <td className="px-4 py-3.5 font-bold text-xs text-muted">#{item.rank}</td>
                                            <td className="px-4 py-3.5 font-bold text-sm text-foreground">{item.username}</td>
                                            <td className="px-4 py-3.5 font-mono text-xs text-muted">{item.walletAddress}</td>
                                            <td className="px-4 py-3.5 font-black text-sm text-foreground">
                                                ${item.amount.toFixed(2)} <span className="text-xs text-brand-green">{item.token}</span>
                                            </td>
                                            <td className="px-4 py-3.5 text-right">
                                                <span
                                                    className={cn(
                                                        "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                                                        item.status === "sent"
                                                            ? "bg-success-background text-success border-success/30"
                                                            : "bg-warning-background text-warning border-warning/30"
                                                    )}
                                                >
                                                    {item.status === "sent" ? "Completed" : "Ready"}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right: Treasury Wallet Balances */}
                <div className="space-y-6">
                    <div className="bg-card border border-border-subtle rounded-3xl p-6 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Wallet className="w-5 h-5 text-brand-blue" />
                            <h3 className="text-base font-bold text-foreground">Disbursement Treasury</h3>
                        </div>

                        <div className="p-4 bg-muted/10 rounded-2xl border border-border-subtle space-y-1">
                            <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Main Custodial Address</span>
                            <p className="font-mono text-xs text-foreground truncate">0x789b91048b23c12f0a827419e99a82</p>
                        </div>

                        <div className="space-y-3">
                            <div className="p-4 rounded-2xl bg-card border border-border-subtle flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-success-background text-success flex items-center justify-center font-bold">
                                        <Coins className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-muted uppercase tracking-widest">USDC Reserve</div>
                                        <div className="text-base font-black text-foreground">$25,000.00</div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 rounded-2xl bg-card border border-border-subtle flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-brand-blue/10 text-brand-blue flex items-center justify-center font-bold">
                                        <Globe className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-muted uppercase tracking-widest">APT Reserve</div>
                                        <div className="text-base font-black text-foreground">1,452.80 APT</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
