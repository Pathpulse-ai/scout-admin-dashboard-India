"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    Plus,
    Video,
    CloudUpload,
    X,
    Loader2,
    Trash2,
    AlertCircle,
    Film,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    StoredVideo,
    listVideos,
    saveVideo,
    removeVideo,
    newVideoId,
    formatBytes,
    isVideoFile,
    nameFromFile,
} from "@/lib/videoLibrary";

/** A stored video plus the object URL used to preview it on this page. */
interface LibraryVideo extends StoredVideo {
    url: string;
}

type LibraryStatus = "loading" | "ready" | "saving" | "unavailable";

const statusLabel: Record<LibraryStatus, string> = {
    loading: "Loading",
    ready: "Ready",
    saving: "Saving",
    unavailable: "Unavailable",
};

function formatDate(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function VideoUploadPage() {
    const [videos, setVideos] = useState<LibraryVideo[]>([]);
    const [status, setStatus] = useState<LibraryStatus>("loading");
    const [pageError, setPageError] = useState<string | null>(null);
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    /** Always rendered, so the dialog can hand focus back here when its opener is gone. */
    const headerUploadRef = useRef<HTMLButtonElement | null>(null);

    // Object URLs are owned here so they can be revoked when the page unmounts.
    const urlsRef = useRef<Map<string, string>>(new Map());
    const urlFor = useCallback((video: StoredVideo) => {
        const existing = urlsRef.current.get(video.id);
        if (existing) return existing;
        const url = URL.createObjectURL(video.blob);
        urlsRef.current.set(video.id, url);
        return url;
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const rows = await listVideos();
                if (cancelled) return;
                setVideos(rows.map((v) => ({ ...v, url: urlFor(v) })));
                setStatus("ready");
            } catch (err) {
                if (cancelled) return;
                setStatus("unavailable");
                setPageError((err as Error)?.message ?? "Could not open the video library.");
            }
        })();
        const urls = urlsRef.current;
        return () => {
            cancelled = true;
            urls.forEach((url) => URL.revokeObjectURL(url));
            urls.clear();
        };
    }, [urlFor]);

    const handleUpload = async (name: string, file: File) => {
        setStatus("saving");
        setPageError(null);
        const record: StoredVideo = {
            id: newVideoId(),
            name,
            fileName: file.name,
            type: file.type,
            size: file.size,
            createdAt: new Date().toISOString(),
            blob: file,
        };
        try {
            await saveVideo(record);
            setVideos((prev) => [{ ...record, url: urlFor(record) }, ...prev]);
            setStatus("ready");
            return true;
        } catch (err) {
            setStatus("ready");
            const message = (err as Error)?.name === "QuotaExceededError"
                ? "Not enough browser storage left for this video."
                : (err as Error)?.message ?? "Could not save this video.";
            throw new Error(message);
        }
    };

    const handleRemove = async (video: LibraryVideo) => {
        if (!window.confirm(`Remove "${video.name}" from your library?`)) return;
        setPageError(null);
        try {
            await removeVideo(video.id);
            const url = urlsRef.current.get(video.id);
            if (url) {
                URL.revokeObjectURL(url);
                urlsRef.current.delete(video.id);
            }
            setVideos((prev) => prev.filter((v) => v.id !== video.id));
        } catch (err) {
            setPageError((err as Error)?.message ?? "Could not remove this video.");
        }
    };

    const totalBytes = videos.reduce((sum, v) => sum + v.size, 0);
    const canUpload = status === "ready" || status === "saving";
    const countLabel = `${videos.length} ${videos.length === 1 ? "video" : "videos"}`;

    return (
        <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300 pb-16 font-sans">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-2">
                <div>
                    <p className="text-sm font-medium text-[#64748B]">Your workspace</p>
                    <h1 className="text-3xl font-extrabold text-[#0F172A] tracking-tight mt-1">
                        Video Library
                    </h1>
                    <p className="text-sm font-medium text-[#64748B] mt-1">
                        Upload your videos and keep all your detection recordings in one place.
                    </p>
                </div>

                <button
                    ref={headerUploadRef}
                    type="button"
                    onClick={() => setIsUploadOpen(true)}
                    disabled={!canUpload}
                    className="inline-flex items-center gap-2 bg-[#0B1528] hover:bg-[#0B1528]/90 text-white text-sm font-bold px-6 py-3.5 rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
                >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>Upload Video</span>
                </button>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-[20px] border border-[#E2E8F0] p-6 shadow-sm">
                    <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Total videos</p>
                    <p className="text-2xl lg:text-3xl font-black text-[#0F172A] tracking-tight mt-2 tabular-nums">
                        {videos.length.toLocaleString()}
                    </p>
                </div>
                <div className="bg-white rounded-[20px] border border-[#E2E8F0] p-6 shadow-sm">
                    <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Storage</p>
                    <p className="text-2xl lg:text-3xl font-black text-[#0F172A] tracking-tight mt-2 tabular-nums">
                        {formatBytes(totalBytes)}
                    </p>
                </div>
                <div className="bg-white rounded-[20px] border border-[#E2E8F0] p-6 shadow-sm">
                    <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Status</p>
                    <p className="flex items-center gap-2 text-lg font-bold text-[#0F172A] mt-2">
                        <span
                            className={cn(
                                "w-2.5 h-2.5 rounded-full shrink-0",
                                status === "ready" && "bg-[#00DF89]",
                                status === "saving" && "bg-[#F59E0B] animate-pulse",
                                status === "loading" && "bg-[#94A3B8] animate-pulse",
                                status === "unavailable" && "bg-[#EF4444]"
                            )}
                        />
                        {statusLabel[status]}
                    </p>
                </div>
            </div>

            {pageError && (
                <div role="alert" className="flex items-start gap-2.5 bg-[#FEF2F2] border border-[#FECACA] rounded-2xl px-4 py-3">
                    <AlertCircle className="w-4 h-4 text-[#DC2626] mt-0.5 shrink-0" />
                    <p className="text-xs font-semibold text-[#B91C1C]">{pageError}</p>
                </div>
            )}

            {/* Library */}
            <div className="bg-white rounded-[22px] border border-[#E2E8F0] shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-[#E2E8F0] flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-extrabold text-[#0F172A]">Your Videos</h2>
                        <p className="text-sm font-medium text-[#64748B] mt-0.5">Uploaded videos will appear here.</p>
                    </div>
                    <span className="bg-[#F1F5F9] text-[#475569] text-sm font-semibold px-4 py-1.5 rounded-full shrink-0">
                        {countLabel}
                    </span>
                </div>

                {status === "loading" ? (
                    <div className="py-24 flex flex-col items-center justify-center gap-4">
                        <Loader2 className="w-8 h-8 text-[#00DF89] animate-spin" />
                        <p className="text-xs text-[#64748B] font-bold uppercase tracking-widest">Opening your library...</p>
                    </div>
                ) : videos.length === 0 ? (
                    <div className="py-24 px-6 flex flex-col items-center justify-center text-center">
                        <div className="w-20 h-20 rounded-2xl bg-[#F1F5F9] flex items-center justify-center text-[#475569]">
                            <Video className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-[#0F172A] mt-8">Your video library is empty</h3>
                        <p className="text-sm font-medium text-[#64748B] mt-3 max-w-lg leading-relaxed">
                            Upload your first video to start building your video library. You only need
                            to provide a video and a name.
                        </p>
                        <button
                            type="button"
                            onClick={() => setIsUploadOpen(true)}
                            disabled={!canUpload}
                            className="mt-8 bg-[#0B1528] hover:bg-[#0B1528]/90 text-white text-sm font-bold px-8 py-4 rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            Upload Your First Video
                        </button>
                    </div>
                ) : (
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {videos.map((video) => (
                            <div
                                key={video.id}
                                className="bg-white rounded-[18px] border border-[#E2E8F0] shadow-sm overflow-hidden flex flex-col"
                            >
                                <div className="relative aspect-video bg-[#0B1528]">
                                    <video
                                        src={video.url}
                                        controls
                                        preload="metadata"
                                        playsInline
                                        aria-label={video.name}
                                        className="w-full h-full object-contain"
                                    />
                                    <div className="absolute top-3 left-3 flex items-center gap-1 bg-[#0B1528]/85 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-md pointer-events-none">
                                        <Film className="w-3 h-3" />
                                        <span>VIDEO</span>
                                    </div>
                                </div>
                                <div className="p-4 flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <h3 className="text-sm font-extrabold text-[#0F172A] truncate" title={video.name}>
                                            {video.name}
                                        </h3>
                                        <p className="text-[11px] font-medium text-[#64748B] truncate mt-0.5" title={video.fileName}>
                                            {video.fileName}
                                        </p>
                                        <p className="text-[11px] font-semibold text-[#64748B] mt-1.5 font-mono">
                                            {formatBytes(video.size)}
                                            {formatDate(video.createdAt) && <> &middot; {formatDate(video.createdAt)}</>}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleRemove(video)}
                                        title="Remove from library"
                                        aria-label={`Remove ${video.name} from library`}
                                        className="p-2 rounded-lg text-[#64748B] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-colors cursor-pointer shrink-0"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {isUploadOpen && (
                <UploadDialog
                    isSaving={status === "saving"}
                    onClose={() => setIsUploadOpen(false)}
                    onUpload={handleUpload}
                    fallbackFocusRef={headerUploadRef}
                />
            )}
        </div>
    );
}

interface UploadDialogProps {
    isSaving: boolean;
    onClose: () => void;
    /** Resolves true when saved; throws with a user-facing message otherwise. */
    onUpload: (name: string, file: File) => Promise<boolean>;
    /** Receives focus on close when the element that opened the dialog is gone. */
    fallbackFocusRef?: React.RefObject<HTMLElement | null>;
}

/** Which control an error belongs to, so only that control is marked invalid. */
interface UploadError {
    field: "name" | "file" | "save";
    message: string;
}

function UploadDialog({ isSaving, onClose, onUpload, fallbackFocusRef }: UploadDialogProps) {
    const [name, setName] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [error, setError] = useState<UploadError | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const nameInputRef = useRef<HTMLInputElement | null>(null);
    const panelRef = useRef<HTMLDivElement | null>(null);
    const dropZoneRef = useRef<HTMLDivElement | null>(null);
    /** True while a pointer gesture started on the backdrop itself. */
    const downOnBackdropRef = useRef(false);

    // Move focus into the dialog, and hand it back to the opener on close.
    useEffect(() => {
        const previouslyFocused = document.activeElement as HTMLElement | null;
        // The header button is rendered before the dialog, so the ref is
        // already set here; reading it now keeps the cleanup honest.
        const fallback = fallbackFocusRef?.current ?? null;
        nameInputRef.current?.focus();
        return () => {
            // The opener can be gone by now: the empty-state button unmounts
            // once the first video lands. Some browsers also never focus a
            // clicked button, leaving <body> as the previous element.
            const openerStillThere =
                previouslyFocused && previouslyFocused !== document.body && document.contains(previouslyFocused);
            if (openerStillThere) previouslyFocused.focus();
            else fallback?.focus();
        };
    }, [fallbackFocusRef]);

    // While saving every control is disabled, so the panel itself holds focus
    // and Tab has somewhere to stay.
    useEffect(() => {
        if (isSaving) panelRef.current?.focus();
    }, [isSaving]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (!isSaving) onClose();
                return;
            }
            // Keep Tab inside the dialog: the page behind it is inert to the eye
            // but not to the keyboard.
            if (e.key !== "Tab" || !panelRef.current) return;
            const focusable = Array.from(
                panelRef.current.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])'
                )
            );
            if (focusable.length === 0) {
                // Nothing to move to (saving in progress): swallow Tab rather
                // than let it walk into the page behind the dialog.
                e.preventDefault();
                panelRef.current.focus();
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement;
            const outside = !panelRef.current.contains(active);
            if (e.shiftKey && (active === first || outside)) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && (active === last || outside)) {
                e.preventDefault();
                first.focus();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [isSaving, onClose]);

    const acceptFile = (candidate: File | undefined | null) => {
        if (!candidate) return;
        if (!isVideoFile(candidate)) {
            setFile(null);
            setError({ field: "file", message: "Only video files can be uploaded here." });
            return;
        }
        setError(null);
        setFile(candidate);
        setName((current) => (current.trim() ? current : nameFromFile(candidate.name)));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSaving) return;
        const trimmed = name.trim();
        if (!file) {
            setError({ field: "file", message: "Choose a video to upload." });
            return;
        }
        if (!trimmed) {
            setError({ field: "name", message: "Give this video a name." });
            nameInputRef.current?.focus();
            return;
        }
        setError(null);
        try {
            await onUpload(trimmed, file);
            onClose();
        } catch (err) {
            setError({ field: "save", message: (err as Error)?.message ?? "Could not save this video." });
        }
    };

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#0B1528]/60 backdrop-blur-sm animate-in fade-in duration-200"
            onPointerDown={(e) => {
                downOnBackdropRef.current = e.target === e.currentTarget;
            }}
            onClick={(e) => {
                // A drag that starts inside the panel and ends on the backdrop
                // also fires click here; only a gesture that began on the
                // backdrop should close and discard what was typed.
                if (!isSaving && downOnBackdropRef.current && e.target === e.currentTarget) onClose();
            }}
            // A file dropped outside the drop zone would otherwise navigate the
            // tab to the file and lose the page. Only the zone accepts files,
            // so the cursor says "no" everywhere else.
            onDragOver={(e) => {
                if (!dropZoneRef.current?.contains(e.target as Node)) e.dataTransfer.dropEffect = "none";
                e.preventDefault();
            }}
            onDrop={(e) => e.preventDefault()}
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="upload-video-title"
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg bg-white rounded-[24px] shadow-2xl border border-[#E2E8F0] animate-in zoom-in-95 fade-in duration-200 focus:outline-none"
            >
                <div className="px-6 py-5 border-b border-[#E2E8F0] flex items-center justify-between gap-4">
                    <div>
                        <h2 id="upload-video-title" className="text-lg font-extrabold text-[#0F172A]">
                            Upload video
                        </h2>
                        <p className="text-xs font-medium text-[#64748B] mt-0.5">
                            Pick a video file and give it a name.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        aria-label="Close"
                        className="p-2 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors cursor-pointer disabled:opacity-50"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="space-y-2">
                        <label htmlFor="video-name" className="text-xs font-bold text-[#0F172A]">
                            Video name
                        </label>
                        <input
                            id="video-name"
                            ref={nameInputRef}
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Ring Road helmet check, 24 Sep"
                            maxLength={120}
                            disabled={isSaving}
                            aria-invalid={error?.field === "name"}
                            aria-describedby={error && error.field !== "file" ? "upload-error" : undefined}
                            className="w-full bg-white border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm font-medium text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#00DF89]/30 focus:border-[#00DF89] transition-all disabled:opacity-60"
                        />
                    </div>

                    <div className="space-y-2">
                        <span id="video-file-label" className="block text-xs font-bold text-[#0F172A]">
                            Video file
                        </span>
                        {/* The drop zone below is the exposed control; the native
                            input only exists to open the picker. */}
                        <input
                            ref={fileInputRef}
                            id="video-file"
                            type="file"
                            accept="video/*"
                            className="sr-only"
                            tabIndex={-1}
                            aria-hidden="true"
                            disabled={isSaving}
                            onChange={(e) => {
                                acceptFile(e.target.files?.[0]);
                                // Allow picking the same file again after a failed attempt.
                                e.target.value = "";
                            }}
                        />
                        <div
                            ref={dropZoneRef}
                            role="button"
                            tabIndex={isSaving ? -1 : 0}
                            aria-disabled={isSaving}
                            aria-labelledby="video-file-label"
                            aria-describedby={error && error.field !== "name" ? "upload-error" : undefined}
                            onClick={() => !isSaving && fileInputRef.current?.click()}
                            onKeyDown={(e) => {
                                if ((e.key === "Enter" || e.key === " ") && !isSaving) {
                                    e.preventDefault();
                                    fileInputRef.current?.click();
                                }
                            }}
                            onDragOver={(e) => {
                                e.preventDefault();
                                if (!isSaving) setIsDragging(true);
                            }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setIsDragging(false);
                                if (isSaving) return;
                                acceptFile(e.dataTransfer.files?.[0]);
                            }}
                            className={cn(
                                "rounded-2xl border-2 border-dashed px-6 py-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B1528] focus-visible:ring-offset-2",
                                isDragging
                                    ? "border-[#00DF89] bg-[#E6FAF2]"
                                    : file
                                        ? "border-[#00DF89]/60 bg-[#F8FAFC]"
                                        : "border-[#CBD5E1] bg-[#F8FAFC] hover:border-[#94A3B8]",
                                isSaving && "opacity-60 cursor-not-allowed"
                            )}
                        >
                            {file ? (
                                <>
                                    <div className="w-12 h-12 rounded-xl bg-[#E6FAF2] flex items-center justify-center text-[#059669]">
                                        <Film className="w-5 h-5" />
                                    </div>
                                    <p className="text-sm font-bold text-[#0F172A] mt-3 truncate max-w-full" title={file.name}>
                                        {file.name}
                                    </p>
                                    <p className="text-xs font-semibold text-[#475569] mt-1 font-mono">{formatBytes(file.size)}</p>
                                    <p className="text-[11px] font-medium text-[#475569] mt-2">Click or drop another file to replace it</p>
                                </>
                            ) : (
                                <>
                                    <div className="w-12 h-12 rounded-xl bg-[#F1F5F9] flex items-center justify-center text-[#475569]">
                                        <CloudUpload className="w-5 h-5" />
                                    </div>
                                    <p className="text-sm font-bold text-[#0F172A] mt-3">Drop a video here or click to browse</p>
                                    <p className="text-[11px] font-medium text-[#475569] mt-1">MP4, MOV, WebM and other video formats</p>
                                </>
                            )}
                        </div>
                    </div>

                    {error && (
                        <div
                            id="upload-error"
                            role="alert"
                            className="flex items-start gap-2 bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-3.5 py-2.5"
                        >
                            <AlertCircle className="w-4 h-4 text-[#DC2626] mt-0.5 shrink-0" />
                            <p className="text-xs font-semibold text-[#B91C1C]">{error.message}</p>
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSaving}
                            className="px-5 py-2.5 rounded-xl text-sm font-bold text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors cursor-pointer disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="inline-flex items-center gap-2 bg-[#0B1528] hover:bg-[#0B1528]/90 text-white text-sm font-bold px-6 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <CloudUpload className="w-4 h-4" />
                                    <span>Upload</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
