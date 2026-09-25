"use client";

import React, { useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { User, Shield, Palette, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
    const router = useRouter();
    const [fullName, setFullName] = useState("Admin User");
    const [email, setEmail] = useState("admin@pathpulse.ai");
    const [savedNotification, setSavedNotification] = useState(false);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        setSavedNotification(true);
        setTimeout(() => setSavedNotification(false), 2500);
    };

    const handleSignOut = () => {
        if (typeof window !== "undefined") {
            localStorage.removeItem("pathpulse_auth");
            localStorage.removeItem("pathpulse_user");
        }
        router.push("/");
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-6xl mx-auto pb-12">
            <PageHeader
                title="Account Settings"
                subtitle="System / Preferences"
            />

            {savedNotification && (
                <div className="p-4 rounded-2xl bg-success-background border border-success/30 text-success text-sm font-bold flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-5 h-5" />
                    Profile preferences updated successfully.
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Settings Area */}
                <div className="lg:col-span-2 space-y-6">

                    <section className="bg-card rounded-3xl border border-border-subtle p-8 shadow-sm">
                        <h3 className="text-xl font-black text-brand-blue tracking-tight flex items-center gap-2 mb-8">
                            <User className="w-5 h-5 text-brand-green" />
                            Profile Information
                        </h3>

                        <form onSubmit={handleSave} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-brand-gray uppercase tracking-widest pl-2">Full Name</label>
                                    <input
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="w-full bg-background border border-border-subtle rounded-2xl px-5 py-3.5 text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-brand-gray uppercase tracking-widest pl-2">Email Address</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-background border border-border-subtle rounded-2xl px-5 py-3.5 text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all"
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                className="px-6 py-3 bg-brand-green text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl hover:bg-brand-green/90 transition-all cursor-pointer shadow-sm active:scale-95"
                            >
                                Save Changes
                            </button>
                        </form>
                    </section>
                </div>

                {/* Sidebar Info */}
                <div className="space-y-6">
                    <div className="bg-card rounded-3xl border border-border-subtle p-8 shadow-sm">
                        <h4 className="text-sm font-black text-brand-blue uppercase tracking-widest flex items-center gap-2 mb-4">
                            <Shield className="w-4 h-4 text-brand-green" />
                            Account Session
                        </h4>
                        <p className="text-xs text-brand-gray font-medium italic mb-6">
                            Ready to end your current session? You can sign out here.
                        </p>
                        <button
                            onClick={handleSignOut}
                            className="w-full py-3.5 text-red-500 font-bold text-xs uppercase tracking-widest rounded-2xl border border-red-500/20 bg-red-500/10 hover:bg-red-500 hover:text-white transition-all cursor-pointer active:scale-95"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
