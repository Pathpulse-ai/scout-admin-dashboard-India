'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Loader2, ArrowRight } from 'lucide-react';

const HOME = '/detections';

/** Where to land after sign-in: the page that bounced us here, if it is ours. */
function nextDestination(): string {
    if (typeof window === 'undefined') return HOME;
    const next = new URLSearchParams(window.location.search).get('next');
    return next && next.startsWith('/') && !next.startsWith('//') ? next : HOME;
}

export default function LoginPage() {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ password }),
            });
            if (res.ok) {
                router.replace(nextDestination());
                router.refresh();
                return;
            }
            const data = await res.json().catch(() => ({})) as { error?: string };
            setError(data.error || 'Sign-in failed. Please try again.');
        } catch {
            setError('Unable to reach the server. Check the connection and retry.');
        }
        setIsSubmitting(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4 font-sans">
            <div className="max-w-md w-full">
                {/* Logo / Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-green/10 text-brand-green mb-4">
                        <Lock className="w-7 h-7" />
                    </div>
                    <h1 className="text-3xl font-extrabold text-foreground tracking-tight">PathPulse Admin</h1>
                    <p className="mt-2 text-brand-gray font-medium text-sm">Enter the access password to continue</p>
                </div>

                {/* Login Card */}
                <div className="bg-card rounded-3xl shadow-card border border-border-subtle p-8 md:p-10">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="p-3.5 rounded-xl bg-danger-background border border-danger/20 text-danger text-sm font-medium animate-in fade-in">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label htmlFor="password" className="text-sm font-semibold text-foreground ml-1">Password</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-brand-gray group-focus-within:text-brand-green transition-colors" />
                                </div>
                                <input
                                    id="password"
                                    type="password"
                                    required
                                    autoFocus
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        if (error) setError('');
                                    }}
                                    className={`block w-full pl-11 pr-4 py-3.5 bg-background border rounded-2xl text-foreground placeholder:text-brand-gray/50 focus:outline-none focus:ring-2 transition-all ${
                                        error
                                            ? 'border-danger focus:ring-danger/20 focus:border-danger'
                                            : 'border-border-subtle focus:ring-brand-green/20 focus:border-brand-green'
                                    }`}
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full flex items-center justify-center gap-2 py-4 px-4 border border-transparent rounded-2xl shadow-lg shadow-brand-green/20 text-sm font-bold text-white bg-brand-green hover:bg-brand-green/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-green disabled:opacity-70 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                        >
                            {isSubmitting ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <>
                                    <span>Sign in</span>
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Footer Info */}
                <p className="mt-8 text-center text-brand-gray text-xs font-medium tracking-wide">
                    &copy; {new Date().getFullYear()} PathPulse AI. All rights reserved.
                </p>
            </div>
        </div>
    );
}
