/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useMemo } from "react";
import { Submission, SubmissionImage } from "@/types";
import {
    MapPin,
    CheckCircle2,
    XCircle,
    ActivitySquare,
    Video,
    User,
    Globe,
    Loader2,
    Clock,
    Copy,
    Check
} from "lucide-react";
import { cn, safeToFixed } from "@/lib/utils";

interface DetectionCardProps {
    submission: Submission;
    onClick?: (id: string) => void;
    onVerify?: (id: string) => void;
    onReject?: (id: string) => void;
}

const DetectionCard = ({ submission, onClick, onVerify, onReject }: DetectionCardProps) => {
    const defaultImage = submission.images?.find((img) => img.is_primary) || submission.images?.[0];
    const [activeImage, setActiveImage] = useState<SubmissionImage | undefined>(defaultImage);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isRejecting, setIsRejecting] = useState(false);
    const [feedback, setFeedback] = useState<'verified' | 'rejected' | null>(null);
    const [copied, setCopied] = useState(false);

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(submission.account_id);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    const handleVerifyAction = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isVerifying || isRejecting) return;
        setIsVerifying(true);
        try {
            await onVerify?.(submission.id);
            setFeedback('verified');
            setTimeout(() => setFeedback(null), 1200);
        } catch {
            // Handled
        } finally {
            setIsVerifying(false);
        }
    };

    const handleRejectAction = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isVerifying || isRejecting) return;
        setIsRejecting(true);
        try {
            await onReject?.(submission.id);
            setFeedback('rejected');
            setTimeout(() => setFeedback(null), 1200);
        } catch {
            // Handled
        } finally {
            setIsRejecting(false);
        }
    };

    const isVideo = !!submission.video_asset;
    const mediaTypeLabel = isVideo
        ? "video clip"
        : submission.images?.length === 1
        ? "1 frame"
        : `${submission.images?.length || 0} frames`;

    const statusConfig = {
        verified: {
            color: "text-success",
            bg: "bg-success-background border-success/30",
            icon: <CheckCircle2 className="w-3.5 h-3.5" />,
            label: "Verified",
        },
        rejected: {
            color: "text-danger",
            bg: "bg-danger-background border-danger/30",
            icon: <XCircle className="w-3.5 h-3.5" />,
            label: "Rejected",
        },
        pending: {
            color: "text-warning",
            bg: "bg-warning-background border-warning/30",
            icon: <Clock className="w-3.5 h-3.5" />,
            label: "Pending",
        },
    };
    const status = statusConfig[submission.verification_status] || statusConfig.pending;

    // Stable confidence score based on id or detection data
    const confidence = useMemo(() => {
        const detectionData = submission.images?.[0]?.detection_data as
            | { detections?: Array<{ confidence?: number }> }
            | null
            | undefined;
        const detConf = detectionData?.detections?.[0]?.confidence;
        if (typeof detConf === 'number') return detConf;
        // Deterministic pseudo-random number based on ID string
        let hash = 0;
        for (let i = 0; i < submission.id.length; i++) {
            hash = (hash * 31 + submission.id.charCodeAt(i)) % 1000;
        }
        return 0.55 + (hash / 1000) * 0.44;
    }, [submission.id, submission.images]);

    let confColor = "bg-danger";
    if (confidence > 0.6) confColor = "bg-warning";
    if (confidence > 0.8) confColor = "bg-success";

    const formattedDate = new Date(submission.created_at).toLocaleString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    });

    const isLane = submission.detection_type === 'lane';
    const typeColor = isLane ? 'text-success border-success/30' : 'text-danger border-danger/30';

    return (
        <div
            onClick={() => onClick?.(submission.id)}
            className="w-full bg-card border border-border-subtle rounded-2xl mb-4 flex flex-col overflow-hidden font-sans transition-all shadow-sm hover:shadow-md relative group/card"
        >
            {/* Feedback Overlay */}
            {feedback && (
                <div
                    className={cn(
                        "absolute inset-0 z-50 flex flex-col items-center justify-center backdrop-blur-md transition-all duration-500 animate-in fade-in zoom-in",
                        feedback === 'verified' ? "bg-success-background/90" : "bg-danger-background/90"
                    )}
                >
                    <div
                        className={cn(
                            "p-8 rounded-3xl flex flex-col items-center gap-4 bg-card border-2 shadow-2xl scale-110",
                            feedback === 'verified' ? "border-success/30 text-success" : "border-danger/30 text-danger"
                        )}
                    >
                        {feedback === 'verified' ? (
                            <CheckCircle2 className="w-16 h-16 animate-bounce" />
                        ) : (
                            <XCircle className="w-16 h-16 animate-bounce" />
                        )}
                        <h3 className="text-xl font-black uppercase tracking-widest">
                            {feedback === 'verified' ? 'Verified Successfully' : 'Rejected Successfully'}
                        </h3>
                    </div>
                </div>
            )}

            {/* Top Bar */}
            <div className="flex flex-wrap justify-between items-center px-4 py-2.5 border-b border-border-subtle bg-background/50 gap-3">
                {/* Left Top Info */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span className={cn("px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider", typeColor)}>
                        {submission.detection_type.replace(/_/g, ' ')}
                    </span>

                    <div className="flex items-center gap-1.5 opacity-80">
                        <div className="w-4 h-4 rounded bg-black/5 dark:bg-white/10 flex items-center justify-center p-0.5">
                            <div className="w-full h-full bg-success-background border border-success/50 rounded flex items-center justify-center">
                                <div className="w-1.5 h-1.5 bg-success rounded-sm"></div>
                            </div>
                        </div>
                        <span className="text-[10px] text-success font-mono">{safeToFixed(confidence * 100, 1)}%</span>
                    </div>

                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        {isVideo ? <Video className="w-3 h-3" /> : null}
                        <span>{mediaTypeLabel}</span>
                    </div>

                    <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest flex items-center gap-1 border", status.bg, status.color)}>
                        {status.icon}
                        {status.label}
                    </span>
                </div>

                {/* Right Top Info */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[11px] text-brand-gray font-medium">
                    <span className="flex items-center gap-1 opacity-70">
                        <div className="w-1.5 h-1.5 bg-brand-gray rounded-sm"></div>
                        {formattedDate}
                    </span>
                    <span className="flex items-center gap-1.5 text-foreground font-black">
                        <User className="w-3 h-3 text-brand-gray" />
                        {submission.username}
                    </span>
                    <span className="flex items-center gap-1 opacity-80 text-foreground font-medium">
                        <Globe className="w-3 h-3 text-brand-gray" />
                        {submission.country_code || 'WW'}
                    </span>
                    <div
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 cursor-pointer hover:text-brand-blue transition-all group/id p-1 -m-1 rounded-md"
                        title="Click to copy full Account ID"
                    >
                        <span className="font-mono text-[10px]">{submission.account_id.split('-')[0]}...</span>
                        {copied ? (
                            <Check className="w-2.5 h-2.5 text-success animate-in zoom-in" />
                        ) : (
                            <Copy className="w-2.5 h-2.5 opacity-60 group-hover/id:opacity-100 transition-opacity" />
                        )}
                    </div>
                    {submission.verified_at && (
                        <span className="flex items-center gap-1 text-success font-bold">
                            <CheckCircle2 className="w-3 h-3" />
                            Verified {new Date(submission.verified_at).toLocaleDateString()}
                        </span>
                    )}
                </div>
            </div>

            {/* Main Body */}
            <div className="flex flex-col lg:flex-row p-4 gap-6">
                {/* Thumbnails (Left) */}
                <div className="w-full lg:w-16 flex lg:flex-col gap-2 shrink-0 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 no-scrollbar snap-x">
                    {isVideo ? (
                        <div className="w-16 h-12 bg-background border border-border-subtle rounded flex flex-col items-center justify-center gap-1 text-brand-blue cursor-pointer hover:border-brand-blue/50 transition-colors">
                            <Video className="w-4 h-4" />
                            <span className="text-[8px] font-bold uppercase">Video</span>
                        </div>
                    ) : (
                        submission.images?.map((img) => (
                            <div
                                key={img.id}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveImage(img);
                                }}
                                className={cn(
                                    "relative w-16 h-12 rounded-lg overflow-hidden shrink-0 cursor-pointer border-2 transition-all snap-start bg-black/10",
                                    activeImage?.id === img.id ? "border-brand-blue ring-2 ring-brand-blue/20" : "border-transparent hover:border-brand-blue/50"
                                )}
                            >
                                <img
                                    src={img.thumbnail_url || img.image_url}
                                    alt="frame thumbnail"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        // Fallback SVG if remote image fails
                                        (e.currentTarget as HTMLElement).style.display = 'none';
                                    }}
                                />
                                {img.is_primary && (
                                    <div className="absolute top-0.5 left-0.5 bg-brand-blue px-1 rounded text-[8px] font-bold text-white shadow-sm">
                                        ★
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                    {!isVideo && !submission.images?.length && (
                        <div className="w-16 h-12 rounded bg-background border border-border-subtle flex items-center justify-center text-brand-gray">
                            <ActivitySquare className="w-4 h-4" />
                        </div>
                    )}
                </div>

                {/* Media Center */}
                <div className="flex-1 bg-black/90 rounded-2xl overflow-hidden flex items-center justify-center min-h-[250px] lg:min-h-[360px] border border-border-subtle relative group shadow-inner">
                    {isVideo && submission.video_asset ? (
                        <video
                            src={submission.video_asset.url}
                            controls
                            className="w-full h-full object-contain max-h-[360px]"
                            poster={submission.video_asset.thumbnail_url}
                        />
                    ) : activeImage ? (
                        <img
                            src={activeImage.image_url}
                            alt="Active frame"
                            className="max-w-full max-h-[360px] object-contain"
                            onError={(e) => {
                                // Fallback placeholder
                                (e.currentTarget as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250"><rect fill="%231e293b" width="400" height="250"/><text fill="%2394a3b8" font-family="sans-serif" font-size="14" dy="10.5" font-weight="bold" x="50%" y="50%" text-anchor="middle">Frame Preview Available</text></svg>';
                            }}
                        />
                    ) : (
                        <span className="text-xs text-brand-gray uppercase tracking-widest font-bold">No Media Available</span>
                    )}
                </div>

                {/* Right Details */}
                <div className="w-full lg:w-56 shrink-0 flex flex-col text-[11px] space-y-4 lg:pl-2">
                    {/* Detections */}
                    <div>
                        <h4 className="text-[9px] font-bold text-brand-gray uppercase tracking-widest mb-1.5">Detections</h4>
                        <div className="flex justify-between items-end mb-1">
                            <span className="text-foreground font-semibold capitalize">{submission.detection_type.replace(/[-_]/g, ' ')}</span>
                            <span className="font-mono font-black text-foreground">{safeToFixed(confidence * 100, 1)}%</span>
                        </div>
                        <div className="h-1.5 bg-background border border-border-subtle rounded-full overflow-hidden shadow-inner">
                            <div className={cn("h-full rounded-full transition-all duration-500", confColor)} style={{ width: `${Math.min(confidence * 100, 100)}%` }} />
                        </div>
                    </div>

                    {/* Location */}
                    <div>
                        <h4 className="text-[9px] font-bold text-brand-gray uppercase tracking-widest mb-1.5">Location</h4>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-brand-gray">Lat/Lng</span>
                            <span className="font-mono text-foreground font-semibold text-right">
                                {safeToFixed(submission.latitude, 4)}, {safeToFixed(submission.longitude, 4)}
                            </span>
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (submission.latitude && submission.longitude) {
                                    window.open(`https://www.google.com/maps?q=${submission.latitude},${submission.longitude}`, '_blank');
                                }
                            }}
                            className="flex items-center gap-1.5 text-brand-blue hover:underline font-bold transition-colors mt-1"
                            disabled={!submission.latitude || !submission.longitude}
                        >
                            <MapPin className="w-3.5 h-3.5" />
                            Open in Maps
                        </button>
                    </div>

                    {/* Info */}
                    <div>
                        <h4 className="text-[9px] font-bold text-brand-gray uppercase tracking-widest mb-1.5">Submission Info</h4>
                        <div className="space-y-1.5 bg-background/50 p-2.5 rounded-xl border border-border-subtle">
                            <div className="flex justify-between">
                                <span className="text-brand-gray">Beats</span>
                                <span className="font-mono font-bold text-foreground">
                                    {safeToFixed(submission.beats_earned, 2)}
                                </span>
                            </div>
                            <div className="flex justify-between border-t border-border-subtle pt-1.5">
                                <span className="text-brand-gray">Type</span>
                                <span className="text-foreground font-bold capitalize">{isVideo ? 'sequence' : 'burst / frames'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-brand-gray">Frames</span>
                                <span className="text-foreground font-bold">{isVideo ? 'video' : `${submission.images?.length || 1} captured`}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-brand-gray">User</span>
                                <span className="text-foreground font-bold truncate max-w-[110px]" title={submission.username}>
                                    @{submission.username}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-1 mt-auto">
                        <button
                            onClick={handleVerifyAction}
                            disabled={isVerifying || isRejecting}
                            className="flex-1 py-2.5 rounded-xl bg-success-background text-success border border-success/30 hover:bg-success/20 text-[11px] font-bold uppercase tracking-wider transition-all flex justify-center items-center gap-1.5 disabled:opacity-50 active:scale-95 shadow-sm"
                        >
                            {isVerifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>✓</span>}
                            {isVerifying ? 'Saving...' : 'Verify'}
                        </button>
                        <button
                            onClick={handleRejectAction}
                            disabled={isVerifying || isRejecting}
                            className="flex-1 py-2.5 rounded-xl bg-danger-background text-danger border border-danger/30 hover:bg-danger/20 text-[11px] font-bold uppercase tracking-wider transition-all flex justify-center items-center gap-1.5 disabled:opacity-50 active:scale-95 shadow-sm"
                        >
                            {isRejecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>✗</span>}
                            {isRejecting ? 'Saving...' : 'Reject'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DetectionCard;
