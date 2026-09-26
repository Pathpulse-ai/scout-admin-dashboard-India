"use client";

import React, { useEffect, useRef, useState } from "react";
import {
    Plus,
    Video,
    Cloud,
    CloudDownload,
    CloudUpload,
    FolderOpen,
    Laptop,
    X,
    Loader2,
    Trash2,
    AlertCircle,
    Film,
    RotateCcw,
    Scissors,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    LibraryVideo,
    listVideos,
    removeVideo,
    splitVideo,
    unsplitVideo,
    toLibraryVideo,
    formatBytes,
    formatClockLong,
    isVideoFile,
    nameFromFile,
} from "@/lib/videoLibrary";
import {
    ByteSource,
    UploadError,
    UploadProgress,
    abortLibraryUpload,
    fileByteSource,
    uploadToLibrary,
} from "@/lib/multipartUpload";
import {
    driveApiByteSource,
    driveLinkByteSource,
    isDrivePickerConfigured,
    parseDriveFileId,
    pickDriveVideo,
    requestDriveAccessToken,
} from "@/lib/googleDrive";

type LibraryStatus = "loading" | "ready" | "unavailable";

const statusLabel: Record<LibraryStatus, string> = {
    loading: "Loading",
    ready: "Ready",
    unavailable: "Unavailable",
};

function formatDate(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** "45s", "1m 20s" or "2h 05m" for a remaining-time estimate. */
function formatDuration(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0) return "";
    if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${String(Math.round(seconds % 60)).padStart(2, "0")}s`;
    return `${Math.floor(seconds / 3600)}h ${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}m`;
}

export default function VideoUploadPage() {
    const [videos, setVideos] = useState<LibraryVideo[]>([]);
    const [status, setStatus] = useState<LibraryStatus>("loading");
    const [pageError, setPageError] = useState<string | null>(null);
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    /** The video whose split dialog is open. */
    const [splitTarget, setSplitTarget] = useState<LibraryVideo | null>(null);
    /** Always rendered, so the dialog can hand focus back here when its opener is gone. */
    const headerUploadRef = useRef<HTMLButtonElement | null>(null);

    const replaceVideo = (updated: LibraryVideo) =>
        setVideos((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));

    const handleUnsplit = async (video: LibraryVideo) => {
        setPageError(null);
        try {
            replaceVideo(await unsplitVideo(video.id));
        } catch (err) {
            setPageError((err as Error)?.message ?? "Could not remove the split.");
        }
    };

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const rows = await listVideos();
                if (cancelled) return;
                setVideos(rows);
                setStatus("ready");
            } catch (err) {
                if (cancelled) return;
                setStatus("unavailable");
                setPageError((err as Error)?.message ?? "Could not open the video library.");
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const handleRemove = async (video: LibraryVideo) => {
        if (!window.confirm(`Remove "${video.name}" from the library? This deletes it from storage.`)) return;
        setPageError(null);
        try {
            await removeVideo(video.id);
            setVideos((prev) => prev.filter((v) => v.id !== video.id));
        } catch (err) {
            setPageError((err as Error)?.message ?? "Could not remove this video.");
        }
    };

    const totalBytes = videos.reduce((sum, v) => sum + v.size, 0);
    const canUpload = status === "ready";
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
                                        muted
                                        data-silent=""
                                        onVolumeChange={(e) => {
                                            if (!e.currentTarget.muted) e.currentTarget.muted = true;
                                        }}
                                        aria-label={video.name}
                                        className="w-[400px] h-[225px] object-contain"
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
                                            {video.source === "drive" && <> &middot; Google Drive</>}
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

                                {/* Parts: time ranges of this file, each its own entry on the annotation page */}
                                <div className="px-4 pb-4 space-y-2">
                                    {video.fragments.length > 0 && (
                                        <ul className="space-y-1">
                                            {video.fragments.map((f) => (
                                                <li
                                                    key={f.id}
                                                    className="flex items-center justify-between gap-2 text-[11px] font-semibold text-[#475569] bg-[#F8FAFC] border border-[#F1F5F9] rounded-lg px-2.5 py-1.5"
                                                >
                                                    <span>Part {f.position} of {video.fragments.length}</span>
                                                    <span className="font-mono text-[#64748B]">
                                                        {formatClockLong(f.startS)} &ndash; {formatClockLong(f.endS)}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setSplitTarget(video)}
                                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] transition-colors cursor-pointer"
                                        >
                                            <Scissors className="w-3.5 h-3.5" />
                                            {video.fragments.length > 0 ? "Change split" : "Split into parts"}
                                        </button>
                                        {video.fragments.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => void handleUnsplit(video)}
                                                title="Remove the split; captures stay with the video"
                                                className="py-2 px-3 rounded-xl text-xs font-bold bg-[#F1F5F9] hover:bg-[#FEE2E2] hover:text-[#991B1B] text-[#64748B] transition-colors cursor-pointer"
                                            >
                                                Unsplit
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {isUploadOpen && (
                <UploadDialog
                    onClose={() => setIsUploadOpen(false)}
                    onUploaded={(video) => setVideos((prev) => [video, ...prev])}
                    fallbackFocusRef={headerUploadRef}
                />
            )}

            {splitTarget && (
                <SplitDialog
                    video={splitTarget}
                    onClose={() => setSplitTarget(null)}
                    onSaved={(video) => {
                        replaceVideo(video);
                        setSplitTarget(null);
                    }}
                />
            )}
        </div>
    );
}

/** Ways of splitting offered as one click; any count from 2 to 48 can be typed. */
const QUICK_PARTS = [2, 3, 4, 6];
const MAX_PARTS = 48;

interface SplitDialogProps {
    video: LibraryVideo;
    onClose: () => void;
    onSaved: (video: LibraryVideo) => void;
}

/**
 * Split a video into equal parts.
 *
 * The length is read from the file itself in the browser, because the server
 * never opens the video. A part is a time range of the same file: nothing is
 * copied or re-encoded, so a split is instant however big the recording.
 */
function SplitDialog({ video, onClose, onSaved }: SplitDialogProps) {
    const [parts, setParts] = useState(video.fragments.length >= 2 ? video.fragments.length : 3);
    const [durationS, setDurationS] = useState<number | null>(video.durationS);
    const [metaError, setMetaError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const panelRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (durationS) return;
        const probe = document.createElement("video");
        probe.preload = "metadata";
        probe.muted = true;
        const onMeta = () => {
            if (Number.isFinite(probe.duration) && probe.duration > 0) setDurationS(probe.duration);
            else setMetaError("The video's length could not be read.");
        };
        const onErr = () => setMetaError("The video could not be opened to read its length. Reload the page and try again.");
        probe.addEventListener("loadedmetadata", onMeta);
        probe.addEventListener("error", onErr);
        probe.src = video.url;
        return () => {
            probe.removeEventListener("loadedmetadata", onMeta);
            probe.removeEventListener("error", onErr);
            probe.removeAttribute("src");
            probe.load();
        };
    }, [video.url, durationS]);

    useEffect(() => {
        panelRef.current?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !isSaving) onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [isSaving, onClose]);

    const validParts = Number.isInteger(parts) && parts >= 2 && parts <= MAX_PARTS;
    const ranges =
        durationS && validParts
            ? Array.from({ length: parts }, (_, i) => ({
                  position: i + 1,
                  start: (i * durationS) / parts,
                  end: i === parts - 1 ? durationS : ((i + 1) * durationS) / parts,
              }))
            : [];

    const save = async () => {
        if (!durationS || !validParts || isSaving) return;
        setIsSaving(true);
        setError(null);
        try {
            onSaved(await splitVideo(video.id, parts, durationS));
        } catch (err) {
            setError((err as Error)?.message ?? "Could not split the video.");
            setIsSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#0B1528]/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={(e) => {
                if (!isSaving && e.target === e.currentTarget) onClose();
            }}
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="split-video-title"
                tabIndex={-1}
                className="w-full max-w-md bg-white rounded-[24px] shadow-2xl border border-[#E2E8F0] animate-in zoom-in-95 fade-in duration-200 focus:outline-none"
            >
                <div className="px-6 py-5 border-b border-[#E2E8F0] flex items-center justify-between gap-4">
                    <div className="min-w-0">
                        <h2 id="split-video-title" className="text-lg font-extrabold text-[#0F172A]">
                            Split into parts
                        </h2>
                        <p className="text-xs font-medium text-[#64748B] mt-0.5 truncate" title={video.name}>
                            {video.name}
                            {durationS ? ` \u00b7 ${formatClockLong(durationS)} long` : ""}
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

                <div className="p-6 space-y-5">
                    {!durationS && !metaError && (
                        <div className="flex items-center gap-2 text-xs font-bold text-[#0F172A]" role="status">
                            <Loader2 className="w-4 h-4 animate-spin text-[#00DF89]" />
                            Reading the video&rsquo;s length&hellip;
                        </div>
                    )}
                    {metaError && (
                        <div role="alert" className="flex items-start gap-2 bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-3.5 py-2.5">
                            <AlertCircle className="w-4 h-4 text-[#DC2626] mt-0.5 shrink-0" />
                            <p className="text-xs font-semibold text-[#B91C1C]">{metaError}</p>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label htmlFor="split-parts" className="text-xs font-bold text-[#0F172A]">
                            Number of parts
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                id="split-parts"
                                type="number"
                                min={2}
                                max={MAX_PARTS}
                                value={parts}
                                onChange={(e) => setParts(Number(e.target.value))}
                                disabled={isSaving}
                                className="w-24 bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-sm font-bold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#00DF89]/30 focus:border-[#00DF89] disabled:opacity-60"
                            />
                            <div className="flex items-center gap-1">
                                {QUICK_PARTS.map((n) => (
                                    <button
                                        key={n}
                                        type="button"
                                        onClick={() => setParts(n)}
                                        disabled={isSaving}
                                        className={cn(
                                            "w-9 h-9 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60",
                                            parts === n
                                                ? "bg-[#0B1528] text-white"
                                                : "bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]"
                                        )}
                                    >
                                        {n}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {!validParts && (
                            <p className="text-[11px] font-semibold text-[#B91C1C]">Choose between 2 and {MAX_PARTS} parts.</p>
                        )}
                    </div>

                    {ranges.length > 0 && (
                        <ul className="space-y-1 max-h-56 overflow-y-auto">
                            {ranges.map((r) => (
                                <li
                                    key={r.position}
                                    className="flex items-center justify-between gap-2 text-xs font-semibold text-[#334155] bg-[#F8FAFC] border border-[#F1F5F9] rounded-lg px-3 py-2"
                                >
                                    <span>Part {r.position}</span>
                                    <span className="font-mono text-[#64748B]">
                                        {formatClockLong(r.start)} &ndash; {formatClockLong(r.end)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}

                    <p className="text-[11px] font-medium text-[#64748B]">
                        Parts are time ranges of the same file; nothing is copied. Each part is listed on its own on the
                        Video annotation page. Captures already taken stay with the video.
                    </p>

                    {error && (
                        <div role="alert" className="flex items-start gap-2 bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-3.5 py-2.5">
                            <AlertCircle className="w-4 h-4 text-[#DC2626] mt-0.5 shrink-0" />
                            <p className="text-xs font-semibold text-[#B91C1C]">{error}</p>
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
                            type="button"
                            onClick={() => void save()}
                            disabled={!durationS || !validParts || isSaving}
                            className="inline-flex items-center gap-2 bg-[#0B1528] hover:bg-[#0B1528]/90 text-white text-sm font-bold px-6 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scissors className="w-4 h-4" />}
                            <span>{video.fragments.length > 0 ? "Update split" : `Split into ${validParts ? parts : "\u2026"} parts`}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface UploadDialogProps {
    onClose: () => void;
    /** A finished upload, already listed by the server. */
    onUploaded: (video: LibraryVideo) => void;
    /** Receives focus on close when the element that opened the dialog is gone. */
    fallbackFocusRef?: React.RefObject<HTMLElement | null>;
}

/** Which control an error belongs to, so only that control is marked invalid. */
interface DialogError {
    field: "name" | "file" | "save";
    message: string;
}

/** Where the video is coming from. */
type UploadSource = "device" | "drive";

/** The bytes waiting to be uploaded, and where they came from. */
interface Chosen {
    source: ByteSource;
    origin: UploadSource;
}

function UploadDialog({ onClose, onUploaded, fallbackFocusRef }: UploadDialogProps) {
    const [name, setName] = useState("");
    const [chosen, setChosen] = useState<Chosen | null>(null);
    const [error, setError] = useState<DialogError | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const nameInputRef = useRef<HTMLInputElement | null>(null);
    const panelRef = useRef<HTMLDivElement | null>(null);
    const dropZoneRef = useRef<HTMLDivElement | null>(null);
    /** True while a pointer gesture started on the backdrop itself. */
    const downOnBackdropRef = useRef(false);

    const [tab, setTab] = useState<UploadSource>("device");
    const [driveLink, setDriveLink] = useState("");
    /** Set while Drive is being asked about a file, before any bytes move. */
    const [driveBusy, setDriveBusy] = useState<string | null>(null);
    const pickerConfigured = isDrivePickerConfigured();

    const [progress, setProgress] = useState<UploadProgress | null>(null);
    const isUploading = progress !== null;
    const abortRef = useRef<AbortController | null>(null);
    const uploadIdRef = useRef<string | null>(null);
    /** Set after a failed attempt; the same source can be retried and will resume. */
    const [canRetry, setCanRetry] = useState(false);

    // Move focus into the dialog, and hand it back to the opener on close.
    useEffect(() => {
        const previouslyFocused = document.activeElement as HTMLElement | null;
        const fallback = fallbackFocusRef?.current ?? null;
        nameInputRef.current?.focus();
        return () => {
            const openerStillThere =
                previouslyFocused && previouslyFocused !== document.body && document.contains(previouslyFocused);
            if (openerStillThere) previouslyFocused.focus();
            else fallback?.focus();
        };
    }, [fallbackFocusRef]);

    // Leaving the page mid-upload stops the requests. The upload itself is
    // left open on the server so picking the same file again resumes it.
    useEffect(() => () => abortRef.current?.abort(), []);

    // While uploading every control is disabled, so the panel itself holds
    // focus and Tab has somewhere to stay.
    useEffect(() => {
        if (isUploading) panelRef.current?.focus();
    }, [isUploading]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (!isUploading) onClose();
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
    }, [isUploading, onClose]);

    const choose = (source: ByteSource, origin: UploadSource) => {
        setError(null);
        setCanRetry(false);
        setChosen({ source, origin });
        setName((current) => (current.trim() ? current : nameFromFile(source.name)));
    };

    const acceptFile = (candidate: File | undefined | null) => {
        if (!candidate) return;
        if (!isVideoFile(candidate)) {
            setChosen(null);
            setError({ field: "file", message: "Only video files can be uploaded here." });
            return;
        }
        choose(fileByteSource(candidate), "device");
    };

    const browseDrive = async () => {
        if (isUploading || driveBusy) return;
        setError(null);
        try {
            setDriveBusy("Waiting for Google sign-in…");
            const token = await requestDriveAccessToken();
            setDriveBusy(null);
            const pick = await pickDriveVideo(token);
            if (!pick) return; // the picker was closed
            setDriveBusy(`Checking ${pick.name}…`);
            const source = await driveApiByteSource(pick, token);
            if (!isVideoFile(source)) {
                setError({ field: "file", message: "That Google Drive file is not a video." });
                return;
            }
            choose(source, "drive");
        } catch (err) {
            setError({ field: "file", message: (err as Error)?.message ?? "Google Drive is not available right now." });
        } finally {
            setDriveBusy(null);
        }
    };

    const fetchDriveLink = async () => {
        if (isUploading || driveBusy) return;
        const id = parseDriveFileId(driveLink);
        if (!id) {
            setError({
                field: "file",
                message: "Paste a Google Drive share link, for example https://drive.google.com/file/d/…/view",
            });
            return;
        }
        setError(null);
        try {
            setDriveBusy("Asking Google Drive about the file…");
            const source = await driveLinkByteSource(id);
            if (!isVideoFile(source)) {
                setError({ field: "file", message: "That Google Drive file is not a video." });
                return;
            }
            choose(source, "drive");
        } catch (err) {
            setError({ field: "file", message: (err as Error)?.message ?? "Could not read the file from Google Drive." });
        } finally {
            setDriveBusy(null);
        }
    };

    const cancelUpload = async () => {
        abortRef.current?.abort();
        const id = uploadIdRef.current;
        uploadIdRef.current = null;
        if (id) await abortLibraryUpload(id);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isUploading || driveBusy) return;
        const trimmed = name.trim();
        if (!chosen) {
            setError({ field: "file", message: "Choose a video to upload." });
            return;
        }
        if (!trimmed) {
            setError({ field: "name", message: "Give this video a name." });
            nameInputRef.current?.focus();
            return;
        }
        setError(null);
        setCanRetry(false);

        const controller = new AbortController();
        abortRef.current = controller;
        try {
            const record = await uploadToLibrary({
                source: chosen.source,
                name: trimmed,
                origin: chosen.origin,
                signal: controller.signal,
                onStarted: (id) => {
                    uploadIdRef.current = id;
                },
                onProgress: setProgress,
            });
            uploadIdRef.current = null;
            onUploaded(toLibraryVideo(record));
            onClose();
        } catch (err) {
            const kind = err instanceof UploadError ? err.kind : "server";
            setProgress(null);
            if (kind === "aborted") return; // cancelled by the officer; parts dropped in cancelUpload
            setCanRetry(true);
            setError({ field: "save", message: (err as Error)?.message ?? "The upload failed." });
        } finally {
            abortRef.current = null;
        }
    };

    const pct = progress && progress.totalBytes > 0 ? (progress.uploadedBytes / progress.totalBytes) * 100 : 0;
    const remainingS =
        progress && progress.bytesPerSecond
            ? (progress.totalBytes - progress.uploadedBytes) / progress.bytesPerSecond
            : null;
    const controlsLocked = isUploading || driveBusy !== null;

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#0B1528]/60 backdrop-blur-sm animate-in fade-in duration-200"
            onPointerDown={(e) => {
                downOnBackdropRef.current = e.target === e.currentTarget;
            }}
            onClick={(e) => {
                // Only a gesture that began on the backdrop should close and
                // discard what was typed; never while an upload is running.
                if (!isUploading && downOnBackdropRef.current && e.target === e.currentTarget) onClose();
            }}
            // A file dropped outside the drop zone would otherwise navigate the
            // tab to the file and lose the page.
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
                            Pick a video from this device or Google Drive, and give it a name.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isUploading}
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
                            disabled={controlsLocked}
                            aria-invalid={error?.field === "name"}
                            aria-describedby={error && error.field !== "file" ? "upload-error" : undefined}
                            className="w-full bg-white border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm font-medium text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#00DF89]/30 focus:border-[#00DF89] transition-all disabled:opacity-60"
                        />
                    </div>

                    {progress ? (
                        /* The upload itself: one bar for the whole file. */
                        <div className="space-y-3 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4" role="status" aria-live="polite">
                            <div className="flex items-center justify-between gap-3 text-xs">
                                <span className="font-bold text-[#0F172A] truncate">
                                    {progress.phase === "starting"
                                        ? "Starting the upload…"
                                        : progress.phase === "finishing"
                                          ? "Finishing…"
                                          : chosen?.source.name}
                                </span>
                                <span className="font-mono font-semibold text-[#475569] shrink-0">
                                    {Math.floor(pct)}%
                                </span>
                            </div>
                            <div className="h-2 rounded-full bg-[#E2E8F0] overflow-hidden">
                                <div
                                    className={cn(
                                        "h-full rounded-full bg-[#00DF89] transition-[width]",
                                        progress.phase !== "uploading" && "animate-pulse"
                                    )}
                                    style={{ width: `${progress.phase === "finishing" ? 100 : Math.min(100, pct)}%` }}
                                />
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] font-semibold text-[#64748B] font-mono">
                                <span>
                                    {formatBytes(progress.uploadedBytes)} of {formatBytes(progress.totalBytes)}
                                    {progress.partCount > 1 &&
                                        ` · part ${Math.min(progress.partsDone + 1, progress.partCount)} of ${progress.partCount}`}
                                </span>
                                <span>
                                    {progress.bytesPerSecond ? `${formatBytes(progress.bytesPerSecond)}/s` : ""}
                                    {remainingS !== null && remainingS > 1 && ` · ${formatDuration(remainingS)} left`}
                                </span>
                            </div>
                            {progress.resumed && (
                                <p className="text-[11px] font-medium text-[#1D4ED8]">
                                    Resumed: the parts from the earlier attempt were kept.
                                </p>
                            )}
                            <button
                                type="button"
                                onClick={() => void cancelUpload()}
                                className="text-xs font-bold text-[#64748B] hover:text-[#DC2626] cursor-pointer"
                            >
                                Cancel upload
                            </button>
                        </div>
                    ) : (
                    <div className="space-y-2">
                        <span id="video-file-label" className="block text-xs font-bold text-[#0F172A]">
                            Video file
                        </span>

                        {/* Where the video comes from */}
                        <div
                            role="tablist"
                            aria-label="Video source"
                            className="flex items-center gap-1 bg-[#F1F5F9] rounded-xl p-1"
                        >
                            {(
                                [
                                    ["device", "This device", Laptop],
                                    ["drive", "Google Drive", Cloud],
                                ] as const
                            ).map(([key, label, Icon]) => (
                                <button
                                    key={key}
                                    type="button"
                                    role="tab"
                                    aria-selected={tab === key}
                                    disabled={controlsLocked}
                                    onClick={() => {
                                        setTab(key);
                                        setError(null);
                                    }}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed",
                                        tab === key
                                            ? "bg-white text-[#0F172A] shadow-sm"
                                            : "text-[#64748B] hover:text-[#0F172A]"
                                    )}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    {label}
                                </button>
                            ))}
                        </div>

                        {tab === "drive" && (
                            <div
                                aria-describedby={error && error.field !== "name" ? "upload-error" : undefined}
                                className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-3"
                            >
                                {chosen?.origin === "drive" && !driveBusy && (
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-[#E6FAF2] flex items-center justify-center text-[#059669] shrink-0">
                                            <Film className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-bold text-[#0F172A] truncate" title={chosen.source.name}>
                                                {chosen.source.name}
                                            </p>
                                            <p className="text-xs font-semibold text-[#475569] font-mono">
                                                {formatBytes(chosen.source.size)} &middot; ready to upload from Google Drive
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {driveBusy ? (
                                    <div className="flex items-center gap-2 text-xs font-bold text-[#0F172A]" role="status">
                                        <Loader2 className="w-4 h-4 animate-spin text-[#00DF89]" />
                                        {driveBusy}
                                    </div>
                                ) : (
                                    <>
                                        {pickerConfigured && (
                                            <button
                                                type="button"
                                                onClick={() => void browseDrive()}
                                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0B1528] hover:bg-[#0B1528]/90 text-white text-sm font-bold shadow-sm transition-all cursor-pointer"
                                            >
                                                <FolderOpen className="w-4 h-4" />
                                                Browse Google Drive
                                            </button>
                                        )}
                                        <div className="space-y-1.5">
                                            <label htmlFor="drive-link" className="block text-[11px] font-bold text-[#475569]">
                                                {pickerConfigured ? "Or paste a share link" : "Paste a Google Drive share link"}
                                            </label>
                                            <div className="flex gap-2">
                                                <input
                                                    id="drive-link"
                                                    type="url"
                                                    value={driveLink}
                                                    onChange={(e) => setDriveLink(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        // Enter checks the link; it must not submit the form.
                                                        if (e.key === "Enter") {
                                                            e.preventDefault();
                                                            void fetchDriveLink();
                                                        }
                                                    }}
                                                    placeholder="https://drive.google.com/file/d/…/view"
                                                    aria-invalid={error?.field === "file" && tab === "drive"}
                                                    className="flex-1 min-w-0 bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-sm font-medium text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#00DF89]/30 focus:border-[#00DF89] transition-all"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => void fetchDriveLink()}
                                                    disabled={!driveLink.trim()}
                                                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-[#E2E8F0] text-sm font-bold text-[#0F172A] hover:border-[#00DF89] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                                                >
                                                    <CloudDownload className="w-4 h-4" />
                                                    Use link
                                                </button>
                                            </div>
                                            <p className="text-[11px] font-medium text-[#64748B]">
                                                The file must be shared as &ldquo;Anyone with the link&rdquo;. It is copied to the library
                                                in parts, so large files are fine.
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

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
                            disabled={controlsLocked}
                            onChange={(e) => {
                                acceptFile(e.target.files?.[0]);
                                // Allow picking the same file again after a failed attempt.
                                e.target.value = "";
                            }}
                        />
                        {tab === "device" && (
                        <div
                            ref={dropZoneRef}
                            role="button"
                            tabIndex={controlsLocked ? -1 : 0}
                            aria-disabled={controlsLocked}
                            aria-labelledby="video-file-label"
                            aria-describedby={error && error.field !== "name" ? "upload-error" : undefined}
                            onClick={() => !controlsLocked && fileInputRef.current?.click()}
                            onKeyDown={(e) => {
                                if ((e.key === "Enter" || e.key === " ") && !controlsLocked) {
                                    e.preventDefault();
                                    fileInputRef.current?.click();
                                }
                            }}
                            onDragOver={(e) => {
                                e.preventDefault();
                                if (!controlsLocked) setIsDragging(true);
                            }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setIsDragging(false);
                                if (controlsLocked) return;
                                acceptFile(e.dataTransfer.files?.[0]);
                            }}
                            className={cn(
                                "rounded-2xl border-2 border-dashed px-6 py-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B1528] focus-visible:ring-offset-2",
                                isDragging
                                    ? "border-[#00DF89] bg-[#E6FAF2]"
                                    : chosen
                                        ? "border-[#00DF89]/60 bg-[#F8FAFC]"
                                        : "border-[#CBD5E1] bg-[#F8FAFC] hover:border-[#94A3B8]",
                                controlsLocked && "opacity-60 cursor-not-allowed"
                            )}
                        >
                            {chosen ? (
                                <>
                                    <div className="w-12 h-12 rounded-xl bg-[#E6FAF2] flex items-center justify-center text-[#059669]">
                                        <Film className="w-5 h-5" />
                                    </div>
                                    <p className="text-sm font-bold text-[#0F172A] mt-3 truncate max-w-full" title={chosen.source.name}>
                                        {chosen.source.name}
                                    </p>
                                    <p className="text-xs font-semibold text-[#475569] mt-1 font-mono">
                                        {formatBytes(chosen.source.size)}
                                        {chosen.origin === "drive" && " · from Google Drive"}
                                    </p>
                                    <p className="text-[11px] font-medium text-[#475569] mt-2">Click or drop another file to replace it</p>
                                </>
                            ) : (
                                <>
                                    <div className="w-12 h-12 rounded-xl bg-[#F1F5F9] flex items-center justify-center text-[#475569]">
                                        <CloudUpload className="w-5 h-5" />
                                    </div>
                                    <p className="text-sm font-bold text-[#0F172A] mt-3">Drop a video here or click to browse</p>
                                    <p className="text-[11px] font-medium text-[#475569] mt-1">
                                        MP4, MOV, WebM and other video formats. Multi-hour recordings are uploaded in parts.
                                    </p>
                                </>
                            )}
                        </div>
                        )}
                    </div>
                    )}

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
                            disabled={isUploading}
                            className="px-5 py-2.5 rounded-xl text-sm font-bold text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors cursor-pointer disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={controlsLocked}
                            className="inline-flex items-center gap-2 bg-[#0B1528] hover:bg-[#0B1528]/90 text-white text-sm font-bold px-6 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Uploading...</span>
                                </>
                            ) : canRetry ? (
                                <>
                                    <RotateCcw className="w-4 h-4" />
                                    <span>Retry upload</span>
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
