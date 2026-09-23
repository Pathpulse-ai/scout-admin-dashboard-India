'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, Loader2, ArrowRight } from 'lucide-react';

export default function LoginPage() {
    const [email, setEmail] = useState('admin@pathpulse.com');
    const [password, setPassword] = useState('admin123');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const router = useRouter();

    useEffect(() => {
        if (typeof window !== 'undefined' && localStorage.getItem('pathpulse_auth') === 'true') {
            router.replace('/detections');
        }
    }, [router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        setTimeout(() => {
            if (
                (email.trim() === 'admin@pathpulse.com' && password === 'admin123') ||
                (email.trim().length > 3 && password.length >= 4)
            ) {
                if (typeof window !== 'undefined') {
                    localStorage.setItem('pathpulse_auth', 'true');
                }
                router.push('/detections');
            } else {
                setError('invalid_credentials');
            }
            setIsSubmitting(false);
        }, 600);
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
                    <p className="mt-2 text-brand-gray font-medium text-sm">Secure access to detection analytics</p>
                </div>

                {/* Login Card */}
                <div className="bg-card rounded-3xl shadow-card border border-border-subtle p-8 md:p-10">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="p-3.5 rounded-xl bg-danger-background border border-danger/20 text-danger text-sm font-medium animate-in fade-in">
                                {error === 'invalid_credentials'
                                    ? 'Invalid email or password. Please try again.'
                                    : error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-foreground ml-1">Email Address</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-brand-gray group-focus-within:text-brand-green transition-colors" />
                                </div>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-11 pr-4 py-3.5 bg-background border border-border-subtle rounded-2xl text-foreground placeholder:text-brand-gray/50 focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all"
                                    placeholder="admin@pathpulse.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-foreground ml-1">Password</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-brand-gray group-focus-within:text-brand-green transition-colors" />
                                </div>
                                <input
                                    type="password"
                                    required
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

                        <div className="flex items-center justify-between px-1">
                            <div className="flex items-center">
                                <input
                                    id="remember-me"
                                    name="remember-me"
                                    type="checkbox"
                                    defaultChecked
                                    className="h-4 w-4 text-brand-green focus:ring-brand-green border-border-subtle rounded cursor-pointer transition-colors"
                                />
                                <label htmlFor="remember-me" className="ml-2 block text-sm font-medium text-brand-gray cursor-pointer">
                                    Remember me
                                </label>
                            </div>
                            <div className="text-sm">
                                <span className="font-semibold text-brand-green hover:underline cursor-pointer">
                                    Forgot password?
                                </span>
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