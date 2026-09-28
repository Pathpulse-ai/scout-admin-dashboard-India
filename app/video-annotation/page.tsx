/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Camera,
    Clapperboard,
    Film,
    Keyboard,
    Loader2,
    Maximize2,
    Minimize2,
    Pause,
    Play,
    RotateCcw,
    RotateCw,
    Scissors,
    Trash2,
    TriangleAlert,
    Upload,
    Video,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { LibraryVideo, listVideos, formatBytes } from "@/lib/videoLibrary";
import { formatDetectionTypeLabel } from "@/lib/detectionLabels";
import { DetectionTypeCount } from "@/types";
import ClassLabelDialog from "@/components/detections/ClassLabelDialog";

/** How far either side of the V keypress a clip extends. */
const CLIP_HALF_WINDOW_S = 10;

/** Shorter than this and a "clip" is really just a frame. */
const MIN_CLIP_S = 0.5;

interface SourceVideo {
    id: string;
    name: string;
    url: string;
    sourceKind: "library" | "submission";
    submissionId?: string;
    detail: string;
    /**
     * Set when this entry is one part of a split library video. The part plays
     * the parent's file limited to its range; captures are filed against the
     * parent with their true position in it.
     */
    fragment?: {
        parentId: string;
        parentName: string;
        position: number;
        count: number;
        startS: number;
        endS: number;
    };
}

/** Captures are filed against the whole video, even when taken from a part. */
function captureSourceId(video: SourceVideo): string {
    return video.fragment ? video.fragment.parentId : video.id;
}

/** Rotation is a property of the file, so every part shares the parent's. */
function rotationKey(video: SourceVideo): string {
    return video.fragment ? video.fragment.parentId : video.id;
}

interface SavedAnnotation {
    id: string;
    kind: "frame" | "clip";
    detection_type: string;
    source_video_id: string | null;
    source_name: string | null;
    video_time_s: number;
    clip_start_s: number | null;
    clip_end_s: number | null;
    content_type: string;
    byte_size: number;
    created_at: string;
    media_url: string;
}

/**
 * A capture carries the video it was taken FROM. Saving must never read the
 * currently selected video: an officer can switch videos while a 20-second
 * recording is still running, and the clip would otherwise be filed against
 * the wrong video, and for scout samples against the wrong submission.
 */
type PendingCapture =
    | { kind: "frame"; blob: Blob; previewUrl: string; timeS: number; source: SourceVideo }
    | { kind: "clip"; blob: Blob; previewUrl: string; timeS: number; startS: number; endS: number; source: SourceVideo };

interface RecordingState {
    startS: number;
    endS: number;
    progress: number;
}

/** "12:34.5", or "1:02:03.4" past an hour; without tenths when asked. */
function formatTime(seconds: number, withTenths = true) {
    if (!Number.isFinite(seconds) || seconds < 0) return withTenths ? "0:00.0" : "0:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const tenths = Math.floor((seconds % 1) * 10);
    const base = h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
    return withTenths ? `${base}.${tenths}` : base;
}

/** First recording MIME type this browser supports. */
function pickRecorderMime(): string | undefined {
    if (typeof MediaRecorder === "undefined") return undefined;
    const candidates = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
        "video/mp4",
    ];
    return candidates.find((c) => MediaRecorder.isTypeSupported(c));
}

/**
 * How the picture is turned, in degrees clockwise. Scout videos often arrive
 * on their side; turning them here affects the view AND every frame or clip
 * captured, so the saved evidence is upright.
 */
type Rotation = 0 | 90 | 180 | 270;

/** Per-video rotation, remembered in this browser only. */
const ROTATION_STORE = "pathpulse-video-rotation";

function loadRotation(videoId: string): Rotation {
    try {
        const map = JSON.parse(localStorage.getItem(ROTATION_STORE) ?? "{}") as Record<string, unknown>;
        const r = map[videoId];
        return r === 90 || r === 180 || r === 270 ? r : 0;
    } catch {
        return 0;
    }
}

function saveRotation(videoId: string, rotation: Rotation) {
    try {
        const map = JSON.parse(localStorage.getItem(ROTATION_STORE) ?? "{}") as Record<string, unknown>;
        if (rotation === 0) delete map[videoId];
        else map[videoId] = rotation;
        localStorage.setItem(ROTATION_STORE, JSON.stringify(map));
    } catch {
        // Private mode or blocked storage: the rotation still applies for this visit.
    }
}

/**
 * Draw the current frame onto the canvas turned by `rotation`, sizing the
 * canvas to the turned frame. Used for frame capture and for recording a
 * turned clip.
 */
function drawRotatedFrame(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    rotation: Rotation
) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const sideways = rotation === 90 || rotation === 270;
    const cw = sideways ? vh : vw;
    const ch = sideways ? vw : vh;
    // Resizing resets the context, so size first, then transform.
    if (canvas.width !== cw) canvas.width = cw;
    if (canvas.height !== ch) canvas.height = ch;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(video, -vw / 2, -vh / 2, vw, vh);
}

/** Wait for one event once, with a timeout so a stuck element cannot hang the flow. */
function once(target: EventTarget, event: string, timeoutMs: number) {
    return new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => {
            target.removeEventListener(event, handler);
            reject(new Error(`Timed out waiting for ${event}`));
        }, timeoutMs);
        const handler = () => {
            window.clearTimeout(timer);
            target.removeEventListener(event, handler);
            resolve();
        };
        target.addEventListener(event, handler);
    });
}

export default function VideoAnnotationPage() {
    const [libraryVideos, setLibraryVideos] = useState<SourceVideo[]>([]);
    const [sampleVideos, setSampleVideos] = useState<SourceVideo[]>([]);
    const [selected, setSelected] = useState<SourceVideo | null>(null);
    const [classes, setClasses] = useState<DetectionTypeCount[]>([]);
    const [annotations, setAnnotations] = useState<SavedAnnotation[]>([]);
    const [isListLoading, setIsListLoading] = useState(true);
    const [pending, setPending] = useState<PendingCapture | null>(null);
    const [recording, setRecording] = useState<RecordingState | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const [rotation, setRotation] = useState<Rotation>(0);
    /** Natural frame size and stage size, so a turned picture is scaled to fit. */
    const [frameSize, setFrameSize] = useState<{ w: number; h: number } | null>(null);
    const [stageSize, setStageSize] = useState<{ w: number; h: number } | null>(null);
    const stageBoxRef = useRef<HTMLDivElement | null>(null);
    /**
     * The player has its own transport bar and no native one: the native bar
     * turns with the picture, cannot be held to a part, and carries a volume
     * control. Annotation is silent, and stays silent.
     */
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        const box = stageBoxRef.current;
        if (!box || typeof ResizeObserver === "undefined") return;
        const measure = () => setStageSize({ w: box.clientWidth, h: box.clientHeight });
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(box);
        return () => observer.disconnect();
    }, []);

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    /**
     * The player stage is what goes fullscreen, never the <video> itself. When
     * an element is fullscreen the browser paints only that element and its
     * descendants, so a dialog mounted elsewhere opens invisibly. The dialog,
     * the recording overlay and the toasts are all rendered inside this stage.
     */
    const stageRef = useRef<HTMLDivElement | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const onChange = () => setIsFullscreen(document.fullscreenElement === stageRef.current);
        document.addEventListener("fullscreenchange", onChange);
        return () => document.removeEventListener("fullscreenchange", onChange);
    }, []);

    const toggleFullscreen = useCallback(async () => {
        const stage = stageRef.current;
        if (!stage) return;
        try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else await stage.requestFullscreen();
        } catch {
            setError("Fullscreen is not available in this browser.");
        }
    }, []);

    /**
     * Some browsers ignore controlsList="nofullscreen" and let the native
     * control fullscreen the raw <video>. The dialog cannot be seen there, so a
     * capture from that state drops out of fullscreen first.
     */
    const leaveNativeVideoFullscreen = useCallback(async () => {
        const fs = document.fullscreenElement;
        if (fs && fs !== stageRef.current) {
            try {
                await document.exitFullscreen();
            } catch {
                // If it cannot be left, the dialog still opens on the page.
            }
        }
    }, []);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const cancelRecordingRef = useRef<(() => void) | null>(null);
    /** Mirror of `selected` for callbacks that must not close over a stale value. */
    const selectedRef = useRef<SourceVideo | null>(null);
    useEffect(() => {
        selectedRef.current = selected;
    }, [selected]);
    /** Bumped per annotation load, so a slow response for the previous video is ignored. */
    const loadTokenRef = useRef(0);

    // Videos: the officer's own uploads (from the S3 library, played through
    // presigned URLs) plus a couple of scout samples.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setIsListLoading(true);
            try {
                const [stored, sampleRes, classRes] = await Promise.all([
                    listVideos().catch(() => [] as LibraryVideo[]),
                    fetch("/api/sample-videos").then((r) => (r.ok ? r.json() : { videos: [] })),
                    fetch("/api/detection-types").then((r) => (r.ok ? r.json() : [])),
                ]);
                if (cancelled) return;

                // A split video is listed as its parts, never as a whole.
                const library: SourceVideo[] = stored.flatMap((v) => {
                    const name = v.name || v.fileName;
                    const uploaded = `uploaded ${new Date(v.createdAt).toLocaleDateString()}`;
                    if (v.fragments.length === 0) {
                        return [{ id: v.id, name, url: v.url, sourceKind: "library" as const, detail: `${formatBytes(v.size)} · ${uploaded}` }];
                    }
                    return v.fragments.map((f) => ({
                        id: f.id,
                        name: `${name} · Part ${f.position}/${v.fragments.length}`,
                        url: v.url,
                        sourceKind: "library" as const,
                        detail: `${formatTime(f.startS, false)} – ${formatTime(f.endS, false)} · ${uploaded}`,
                        fragment: {
                            parentId: v.id,
                            parentName: name,
                            position: f.position,
                            count: v.fragments.length,
                            startS: f.startS,
                            endS: f.endS,
                        },
                    }));
                });
                const samples: SourceVideo[] = ((sampleRes as { videos: Array<Record<string, unknown>> }).videos ?? []).map(
                    (v) => ({
                        id: String(v.id),
                        name: String(v.name),
                        url: String(v.url),
                        sourceKind: "submission",
                        submissionId: String(v.submission_id),
                        detail: `${formatDetectionTypeLabel(String(v.detection_type))} · ${
                            typeof v.duration_ms === "number" ? `${(v.duration_ms / 1000).toFixed(1)}s` : "scout video"
                        }${v.username ? ` · ${String(v.username)}` : ""}`,
                    })
                );

                setLibraryVideos(library);
                setSampleVideos(samples);
                setClasses(Array.isArray(classRes) ? (classRes as DetectionTypeCount[]) : []);
                setSelected((current) => current ?? library[0] ?? samples[0] ?? null);
            } finally {
                if (!cancelled) setIsListLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // Saved captures for the open video.
    const loadAnnotations = useCallback(async (video: SourceVideo | null) => {
        const token = ++loadTokenRef.current;
        if (!video) {
            setAnnotations([]);
            return;
        }
        try {
            // A part lists only the captures inside its own range. The end is
            // exclusive so a boundary capture is listed once; the last part
            // reaches past the file's end so a capture at the very end counts.
            const params = new URLSearchParams({ source_video_id: captureSourceId(video), limit: "100" });
            if (video.fragment) {
                const { startS, endS, position, count } = video.fragment;
                params.set("time_from", String(startS));
                params.set("time_to", String(position === count ? endS + 1 : endS));
            }
            const res = await fetch(`/api/annotations?${params.toString()}`);
            if (!res.ok) throw new Error("Could not load annotations");
            const data = (await res.json()) as { annotations: SavedAnnotation[] };
            if (token !== loadTokenRef.current) return; // the officer has moved on
            setAnnotations(data.annotations ?? []);
        } catch {
            if (token === loadTokenRef.current) setAnnotations([]);
        }
    }, []);

    useEffect(() => {
        // A recording in progress belongs to the previous video; stop it.
        cancelRecordingRef.current?.();
        // The previous entry's captures must not show under the new one while its own load.
        setAnnotations([]);
        void loadAnnotations(selected);
        setPending((p) => {
            if (p) URL.revokeObjectURL(p.previewUrl);
            return null;
        });
        setError(null);
        setCurrentTime(selected?.fragment ? selected.fragment.startS : 0);
        setDuration(0);
        setFrameSize(null);
        setIsPlaying(false);
        setRotation(selected ? loadRotation(rotationKey(selected)) : 0);
    }, [selected, loadAnnotations]);

    const rotateBy = useCallback(
        (delta: 90 | -90) => {
            if (!selected) return;
            const next = ((((rotation + delta) % 360) + 360) % 360) as Rotation;
            setRotation(next);
            saveRotation(rotationKey(selected), next);
        },
        [selected, rotation]
    );

    /** The stretch of the file this entry covers: a part's range, or all of it. */
    const bounds = useMemo(
        () => ({
            start: selected?.fragment?.startS ?? 0,
            end: selected?.fragment?.endS ?? (duration || 0),
        }),
        [selected, duration]
    );

    /**
     * CSS turn for the on-screen picture. Sideways, the frame's contained size
     * inside the stage swaps its sides, so it is scaled to fit the stage again.
     */
    const videoTransform = useMemo(() => {
        if (rotation === 0) return undefined;
        if (rotation === 180) return "rotate(180deg)";
        let scale = stageSize && stageSize.w > 0 ? stageSize.h / stageSize.w : 9 / 16;
        if (frameSize && stageSize && frameSize.w > 0 && frameSize.h > 0 && stageSize.w > 0 && stageSize.h > 0) {
            const fit = Math.min(stageSize.w / frameSize.w, stageSize.h / frameSize.h);
            const contentW = frameSize.w * fit;
            const contentH = frameSize.h * fit;
            scale = Math.min(stageSize.w / contentH, stageSize.h / contentW);
        }
        return `rotate(${rotation}deg) scale(${scale})`;
    }, [rotation, frameSize, stageSize]);

    const togglePlay = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) void video.play().catch(() => {});
        else video.pause();
    }, []);

    // Leaving the page mid-recording must not leave a recorder running.
    useEffect(() => () => cancelRecordingRef.current?.(), []);

    // Notices clear themselves.
    useEffect(() => {
        if (!notice) return;
        const id = window.setTimeout(() => setNotice(null), 3500);
        return () => window.clearTimeout(id);
    }, [notice]);

    const discardPending = useCallback(() => {
        setPending((p) => {
            if (p) URL.revokeObjectURL(p.previewUrl);
            return null;
        });
    }, []);

    /** S: the frame on screen right now. */
    const captureFrame = useCallback(async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || !selected) return;
        void leaveNativeVideoFullscreen();

        // Pressing S straight after scrubbing lands mid-seek, when no frame is
        // decoded yet. Wait briefly for one rather than refusing the capture.
        if (video.seeking || video.readyState < 2) {
            try {
                await once(video, video.seeking ? "seeked" : "loadeddata", 3000);
            } catch {
                // fall through to the check below
            }
        }
        if (video.readyState < 2 || !video.videoWidth) {
            setError("The video has not loaded a frame yet.");
            return;
        }

        video.pause();
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        try {
            // Saved the way the officer sees it, turn included.
            drawRotatedFrame(canvas, ctx, video, rotation);
            const timeS = video.currentTime;
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        setError("Could not export the frame.");
                        return;
                    }
                    setError(null);
                    setPending({ kind: "frame", blob, previewUrl: URL.createObjectURL(blob), timeS, source: selected });
                },
                "image/jpeg",
                0.92
            );
        } catch (err) {
            // A cross-origin video without CORS headers taints the canvas.
            setError(
                (err as Error)?.name === "SecurityError"
                    ? "This video's source does not allow frame capture. Upload it on the Video upload page instead."
                    : "Could not capture the frame."
            );
        }
    }, [selected, leaveNativeVideoFullscreen, rotation]);

    /** V: a clip from 10 seconds before the keypress to 10 seconds after. */
    const captureClip = useCallback(async () => {
        const video = videoRef.current;
        if (!video || !selected) return;
        await leaveNativeVideoFullscreen();
        // Some recorded WebMs report Infinity until fully buffered; the seekable
        // range still knows the real end.
        const totalS = Number.isFinite(video.duration)
            ? video.duration
            : video.seekable.length > 0
              ? video.seekable.end(video.seekable.length - 1)
              : 0;
        if (!(totalS > 0)) {
            setError("The video has not loaded yet.");
            return;
        }
        const mime = pickRecorderMime();
        if (!mime) {
            setError("This browser cannot record video clips.");
            return;
        }

        const pressedAt = video.currentTime;
        // A part's clip never reaches outside the part.
        const lowest = selected.fragment?.startS ?? 0;
        const highest = Math.min(totalS, selected.fragment?.endS ?? totalS);
        const startS = Math.max(lowest, pressedAt - CLIP_HALF_WINDOW_S);
        const endS = Math.min(highest, pressedAt + CLIP_HALF_WINDOW_S);
        if (endS - startS < MIN_CLIP_S) {
            setError("The video is too short to cut a clip from.");
            return;
        }

        const wasMuted = video.muted;
        video.pause();
        video.muted = true;
        setError(null);
        setRecording({ startS, endS, progress: 0 });

        let stopped = false;
        const chunks: Blob[] = [];
        let recorder: MediaRecorder | null = null;
        let stream: MediaStream | null = null;
        let rafId = 0;

        const cleanup = () => {
            stopped = true;
            // Esc, a finished window and an error all end here; the element must
            // not be left playing (and audible) from wherever it was.
            video.pause();
            video.removeEventListener("timeupdate", onTime);
            video.removeEventListener("ended", finish);
            if (rafId) cancelAnimationFrame(rafId);
            stream?.getTracks().forEach((t) => t.stop());
            recorderRef.current = null;
            cancelRecordingRef.current = null;
            video.muted = wasMuted;
            setRecording(null);
        };

        const finish = () => {
            if (stopped) return;
            video.pause();
            if (recorder && recorder.state !== "inactive") recorder.stop();
        };

        const onTime = () => {
            if (stopped) return;
            const progress = Math.min(1, (video.currentTime - startS) / (endS - startS));
            setRecording({ startS, endS, progress });
            if (video.currentTime >= endS - 0.05) finish();
        };

        // Cancellable from the very first moment, including during the seek.
        // `stopped` must be raised BEFORE the recorder stops: the code after
        // `await done` reads it to tell a cancel from a finished window, and
        // cleanup() only raises it afterwards.
        cancelRecordingRef.current = () => {
            if (stopped) return;
            stopped = true;
            if (recorder && recorder.state !== "inactive") recorder.stop();
            else cleanup();
        };

        try {
            video.currentTime = startS;
            await once(video, "seeked", 8000);
            // The officer may have switched videos during the seek.
            if (stopped || videoRef.current !== video) {
                cleanup();
                return;
            }

            // captureStream on the element records exactly what plays, but it
            // cannot turn the picture. A turned video is mirrored through the
            // canvas instead, so the clip is saved the way the officer sees
            // it; browsers without captureStream take the same path.
            const withCapture = video as HTMLVideoElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream };
            if (rotation === 0 && typeof withCapture.captureStream === "function") {
                stream = withCapture.captureStream();
            } else if (rotation === 0 && typeof withCapture.mozCaptureStream === "function") {
                stream = withCapture.mozCaptureStream();
            } else {
                const canvas = canvasRef.current!;
                const ctx = canvas.getContext("2d")!;
                const draw = () => {
                    if (stopped) return;
                    drawRotatedFrame(canvas, ctx, video, rotation);
                    rafId = requestAnimationFrame(draw);
                };
                draw();
                stream = canvas.captureStream(30);
            }

            recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1_500_000 });
            recorderRef.current = recorder;
            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) chunks.push(e.data);
            };

            const done = new Promise<Blob>((resolve, reject) => {
                recorder!.onstop = () => resolve(new Blob(chunks, { type: mime.split(";")[0] }));
                recorder!.onerror = () => reject(new Error("Recording failed"));
            });

            video.addEventListener("timeupdate", onTime);
            video.addEventListener("ended", finish);
            recorder.start(250);
            await video.play();

            // Belt and braces: never record past the window even if timeupdate stalls.
            const guard = window.setTimeout(finish, (endS - startS) * 1000 + 3000);
            const blob = await done;
            window.clearTimeout(guard);

            const cancelled = stopped;
            cleanup();
            video.currentTime = pressedAt;

            if (cancelled || blob.size === 0) return;
            setPending({
                kind: "clip",
                blob,
                previewUrl: URL.createObjectURL(blob),
                timeS: pressedAt,
                startS,
                endS,
                source: selected,
            });
        } catch (err) {
            cleanup();
            video.currentTime = pressedAt;
            setError(
                (err as Error)?.name === "SecurityError"
                    ? "This video's source does not allow recording. Upload it on the Video upload page instead."
                    : (err as Error)?.message || "Could not record the clip."
            );
        }
    }, [selected, leaveNativeVideoFullscreen, rotation]);

    /** The label was chosen: file the capture as a validated image. */
    const saveCapture = useCallback(
        async (detectionType: string) => {
            if (!pending) return;
            const source = pending.source;
            setIsSaving(true);
            setError(null);
            try {
                const form = new FormData();
                const ext = pending.kind === "frame" ? "jpg" : "webm";
                form.append("media", new File([pending.blob], `capture.${ext}`, { type: pending.blob.type }));
                form.append("kind", pending.kind);
                form.append("detection_type", detectionType);
                form.append("source_kind", source.sourceKind);
                form.append("source_video_id", captureSourceId(source));
                if (source.submissionId) form.append("source_submission_id", source.submissionId);
                form.append("source_name", source.name);
                form.append("video_time_s", String(pending.timeS));
                if (pending.kind === "clip") {
                    form.append("clip_start_s", String(pending.startS));
                    form.append("clip_end_s", String(pending.endS));
                }

                const res = await fetch("/api/annotations", { method: "POST", body: form });
                if (!res.ok) {
                    const detail = (await res.json().catch(() => null)) as { error?: string } | null;
                    throw new Error(detail?.error ?? `Save failed (HTTP ${res.status})`);
                }
                const data = (await res.json()) as { annotation: SavedAnnotation };
                // Only list it if the officer is still on the video it came from.
                if (selectedRef.current?.id === source.id) {
                    setAnnotations((prev) => [
                        { ...data.annotation, source_video_id: source.id, source_name: source.name },
                        ...prev,
                    ]);
                }
                setNotice(
                    `${pending.kind === "frame" ? "Frame" : "Clip"} saved as ${formatDetectionTypeLabel(detectionType)}`
                );
                discardPending();
            } catch (err) {
                setError((err as Error)?.message ?? "Could not save the capture.");
            } finally {
                setIsSaving(false);
            }
        },
        [pending, discardPending]
    );

    const deleteAnnotation = useCallback(async (id: string) => {
        try {
            const res = await fetch(`/api/annotations/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error(`Delete failed (HTTP ${res.status})`);
            setAnnotations((prev) => prev.filter((a) => a.id !== id));
        } catch (err) {
            setError((err as Error)?.message ?? "Could not delete.");
        }
    }, []);

    // Shortcuts. Latest-ref indirection keeps one listener across renders.
    const handlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
    useEffect(() => {
        handlerRef.current = (e: KeyboardEvent) => {
            if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
            const el = e.target as HTMLElement | null;
            if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;

            const key = e.key.toLowerCase();

            if (recording) {
                if (key === "escape") {
                    e.preventDefault();
                    cancelRecordingRef.current?.();
                }
                return;
            }
            if (pending) return; // the label dialog owns the keyboard
            if (!selected) return;

            if (key === "s") {
                e.preventDefault();
                void captureFrame();
            } else if (key === "v") {
                e.preventDefault();
                void captureClip();
            } else if (key === "f") {
                e.preventDefault();
                void toggleFullscreen();
            } else if (e.key === "[") {
                e.preventDefault();
                rotateBy(-90);
            } else if (e.key === "]") {
                e.preventDefault();
                rotateBy(90);
            }
        };
    });

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => handlerRef.current(e);
        window.addEventListener("keydown", onKeyDown, { capture: true });
        return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
    }, []);

    const allVideos = useMemo(() => [...libraryVideos, ...sampleVideos], [libraryVideos, sampleVideos]);
    const clipWindow = useMemo(() => {
        if (!duration) return null;
        return {
            start: Math.max(bounds.start, currentTime - CLIP_HALF_WINDOW_S),
            end: Math.min(bounds.end, currentTime + CLIP_HALF_WINDOW_S),
        };
    }, [currentTime, duration, bounds]);


    return (
        <div className="max-w-7xl mx-auto pb-16 font-sans space-y-5">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-2">
                <div>
                    <h1 className="text-3xl font-extrabold text-[#0F172A] tracking-tight">Video annotation</h1>
                    <p className="text-sm font-medium text-[#64748B] mt-1">
                        Play a video, capture the frame or clip that shows a violation, and file it as a validated image.
                    </p>
                </div>
                <Link
                    href="/video-upload"
                    className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-[#E2E8F0] bg-white text-xs font-bold text-[#475569] hover:border-[#00DF89] hover:text-[#0F172A] transition-colors"
                >
                    <Upload className="w-4 h-4" />
                    Upload more videos
                </Link>
            </div>

            {/* Shortcut legend */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 bg-white rounded-2xl border border-[#E2E8F0] px-4 py-2.5 shadow-sm">
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#64748B]">
                    <Keyboard className="w-3.5 h-3.5 text-[#94A3B8]" />
                    Shortcuts
                </span>
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#475569]">
                    <kbd className="bg-[#F1F5F9] border border-[#E2E8F0] rounded px-1.5 py-0.5 font-mono font-bold text-[10px] text-[#0F172A]">S</kbd>
                    Capture this frame
                </span>
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#475569]">
                    <kbd className="bg-[#F1F5F9] border border-[#E2E8F0] rounded px-1.5 py-0.5 font-mono font-bold text-[10px] text-[#0F172A]">V</kbd>
                    Save a 20-second clip, 10s either side of now
                </span>
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#475569]">
                    <kbd className="bg-[#F1F5F9] border border-[#E2E8F0] rounded px-1.5 py-0.5 font-mono font-bold text-[10px] text-[#0F172A]">F</kbd>
                    Fullscreen (shortcuts keep working)
                </span>
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#475569]">
                    <kbd className="bg-[#F1F5F9] border border-[#E2E8F0] rounded px-1.5 py-0.5 font-mono font-bold text-[10px] text-[#0F172A]">[</kbd>
                    <kbd className="bg-[#F1F5F9] border border-[#E2E8F0] rounded px-1.5 py-0.5 font-mono font-bold text-[10px] text-[#0F172A]">]</kbd>
                    Rotate left / right (captures are saved turned)
                </span>
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#475569]">
                    <kbd className="bg-[#F1F5F9] border border-[#E2E8F0] rounded px-1.5 py-0.5 font-mono font-bold text-[10px] text-[#0F172A]">Esc</kbd>
                    Cancel
                </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 items-start">
                {/* Video list */}
                <aside className="bg-white rounded-[22px] border border-[#E2E8F0] shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#E2E8F0]">
                        <h2 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">Videos</h2>
                    </div>
                    {isListLoading ? (
                        <div className="py-12 flex items-center justify-center">
                            <Loader2 className="w-5 h-5 text-[#00DF89] animate-spin" />
                        </div>
                    ) : allVideos.length === 0 ? (
                        <div className="p-6 text-center">
                            <Video className="w-7 h-7 text-[#CBD5E1] mx-auto" />
                            <p className="text-xs font-semibold text-[#64748B] mt-2">No videos yet.</p>
                            <Link href="/video-upload" className="text-xs font-bold text-[#00DF89] hover:underline mt-1 inline-block">
                                Upload one
                            </Link>
                        </div>
                    ) : (
                        <ul className="divide-y divide-[#F1F5F9] max-h-[70vh] overflow-y-auto">
                            {libraryVideos.length > 0 && (
                                <li className="px-4 py-2 text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider bg-[#F8FAFC]">
                                    Uploaded
                                </li>
                            )}
                            {libraryVideos.map((v, i) => {
                                // Parts sit under one heading for their video.
                                const startsGroup =
                                    v.fragment && (i === 0 || libraryVideos[i - 1].fragment?.parentId !== v.fragment.parentId);
                                return (
                                    <React.Fragment key={v.id}>
                                        {startsGroup && v.fragment && (
                                            <li className="px-4 pt-2.5 pb-1 flex items-center gap-1.5 text-[11px] font-bold text-[#334155]">
                                                <Scissors className="w-3 h-3 text-[#94A3B8] shrink-0" />
                                                <span className="truncate">{v.fragment.parentName}</span>
                                                <span className="text-[#94A3B8] font-semibold shrink-0">· {v.fragment.count} parts</span>
                                            </li>
                                        )}
                                        <VideoRow
                                            video={v}
                                            active={selected?.id === v.id}
                                            onSelect={() => setSelected(v)}
                                            label={v.fragment ? `Part ${v.fragment.position} of ${v.fragment.count}` : undefined}
                                            indented={Boolean(v.fragment)}
                                        />
                                    </React.Fragment>
                                );
                            })}
                            {sampleVideos.length > 0 && (
                                <li className="px-4 py-2 text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider bg-[#F8FAFC]">
                                    Samples from scouts
                                </li>
                            )}
                            {sampleVideos.map((v) => (
                                <VideoRow key={v.id} video={v} active={selected?.id === v.id} onSelect={() => setSelected(v)} />
                            ))}
                        </ul>
                    )}
                </aside>

                {/* Player + saved captures */}
                <div className="space-y-5 min-w-0">
                    <div
                        ref={stageRef}
                        className={cn(
                            "bg-[#0B1528] relative",
                            isFullscreen
                                ? "w-screen h-screen flex flex-col items-center justify-center"
                                : "rounded-[22px] border border-[#E2E8F0] overflow-hidden shadow-sm"
                        )}
                    >
                        <div
                            ref={stageBoxRef}
                            className={cn("w-full flex items-center justify-center", isFullscreen ? "h-full" : "aspect-video")}
                        >
                            {selected ? (
                                <video
                                    key={selected.id}
                                    ref={videoRef}
                                    src={selected.url}
                                    // Silent, and kept silent: nothing on the page can unmute it.
                                    muted
                                    onVolumeChange={(e) => {
                                        if (!e.currentTarget.muted) e.currentTarget.muted = true;
                                    }}
                                    onClick={togglePlay}
                                    onPlay={() => setIsPlaying(true)}
                                    onPause={() => setIsPlaying(false)}
                                    playsInline
                                    
                                    preload="auto"
                                    style={{ transform: videoTransform }}
                                    // Frame capture draws the video onto a canvas, which is only
                                    // allowed for a CORS-approved source: the library bucket's CORS
                                    // for S3 videos, and the same-origin proxy for scout videos.
                                    crossOrigin="anonymous"
                                    onError={() =>
                                        setError(
                                            selected.sourceKind === "library"
                                                ? "This video could not be loaded. Its playback link may have expired (reload the page), or the S3 bucket's CORS does not allow GET from this site."
                                                : "This video could not be loaded."
                                        )
                                    }
                                    onLoadedMetadata={(e) => {
                                        e.currentTarget.muted = true;
                                        setDuration(e.currentTarget.duration || 0);
                                        setFrameSize({ w: e.currentTarget.videoWidth, h: e.currentTarget.videoHeight });
                                        // A part opens at its own start, not the file's.
                                        if (selected.fragment) e.currentTarget.currentTime = selected.fragment.startS;
                                    }}
                                    onTimeUpdate={(e) => {
                                        const el = e.currentTarget;
                                        const end = selected.fragment?.endS;
                                        // A part stops at its end; the rest of the file is another
                                        // part's. It rests a hair inside, so a capture taken here is
                                        // still this part's.
                                        if (end !== undefined && el.currentTime >= end && !el.paused) {
                                            el.pause();
                                            el.currentTime = Math.max(selected.fragment?.startS ?? 0, end - 0.05);
                                        }
                                        setCurrentTime(el.currentTime);
                                    }}
                                    className="w-full h-full object-contain cursor-pointer"
                                />
                            ) : (
                                <div className="flex flex-col items-center gap-2 text-slate-400">
                                    <Clapperboard className="w-8 h-8" />
                                    <span className="text-[11px] font-bold uppercase tracking-widest">Pick a video to start</span>
                                </div>
                            )}
                        </div>

                        {/* Recording overlay */}
                        {recording && (
                            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3 text-white">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] animate-pulse" />
                                    <span className="text-sm font-extrabold tracking-tight">Recording clip</span>
                                </div>
                                <p className="text-xs font-semibold text-slate-300 font-mono">
                                    {formatTime(recording.startS)} &rarr; {formatTime(recording.endS)}
                                </p>
                                <div className="w-64 h-2 rounded-full bg-white/20 overflow-hidden">
                                    <div className="h-full bg-[#00DF89] rounded-full transition-[width]" style={{ width: `${Math.round(recording.progress * 100)}%` }} />
                                </div>
                                <p className="text-[11px] text-slate-400">The video plays through the window once. Press Esc to cancel.</p>
                            </div>
                        )}

                        {/* Stage controls: rotate and fullscreen */}
                        {selected && (
                            <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
                                {rotation !== 0 && (
                                    <span className="h-9 px-2.5 rounded-xl bg-black/55 text-white text-[11px] font-bold font-mono flex items-center backdrop-blur-md">
                                        {rotation}&deg;
                                    </span>
                                )}
                                <button
                                    onClick={() => rotateBy(-90)}
                                    aria-label="Rotate left"
                                    title="Rotate left ([)"
                                    className="w-9 h-9 rounded-xl bg-black/55 hover:bg-black/75 text-white flex items-center justify-center backdrop-blur-md transition-colors cursor-pointer"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => rotateBy(90)}
                                    aria-label="Rotate right"
                                    title="Rotate right (])"
                                    className="w-9 h-9 rounded-xl bg-black/55 hover:bg-black/75 text-white flex items-center justify-center backdrop-blur-md transition-colors cursor-pointer"
                                >
                                    <RotateCw className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => void toggleFullscreen()}
                                    aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                                    title={isFullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
                                    className="w-9 h-9 rounded-xl bg-black/55 hover:bg-black/75 text-white flex items-center justify-center backdrop-blur-md transition-colors cursor-pointer"
                                >
                                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                                </button>
                            </div>
                        )}

                        {/* Transport: play, seek and time. No volume; the player is silent. */}
                        {selected && !recording && (
                            <div className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-3 px-4 pt-6 pb-3 bg-gradient-to-t from-black/80 to-transparent text-white">
                                <button
                                    onClick={togglePlay}
                                    aria-label={isPlaying ? "Pause" : "Play"}
                                    className="w-8 h-8 rounded-lg hover:bg-white/15 flex items-center justify-center cursor-pointer"
                                >
                                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                </button>
                                <span className="font-mono text-[11px] font-semibold tabular-nums">{formatTime(currentTime)}</span>
                                <input
                                    type="range"
                                    min={bounds.start}
                                    max={bounds.end}
                                    step={0.05}
                                    value={Math.min(Math.max(currentTime, bounds.start), bounds.end)}
                                    onChange={(e) => {
                                        const video = videoRef.current;
                                        if (video) video.currentTime = Number(e.target.value);
                                    }}
                                    aria-label="Seek"
                                    className="flex-1 h-1.5 accent-[#00DF89] cursor-pointer"
                                />
                                <span className="font-mono text-[11px] font-semibold tabular-nums">{formatTime(bounds.end)}</span>
                            </div>
                        )}

                        {/* Toasts live inside the stage so they show in fullscreen as well */}
                        {(error || notice) && (
                            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 max-w-[90%]">
                                {error ? (
                                    <div className="flex items-start gap-2.5 bg-[#FEF2F2]/95 border border-[#FECACA] rounded-2xl px-4 py-2.5 shadow-lg">
                                        <TriangleAlert className="w-4 h-4 text-[#DC2626] mt-0.5 shrink-0" />
                                        <p className="text-xs font-semibold text-[#991B1B]">{error}</p>
                                    </div>
                                ) : (
                                    <div className="bg-[#E6FAF2]/95 border border-[#A7F3D0] rounded-2xl px-4 py-2.5 text-xs font-bold text-[#065F46] shadow-lg">
                                        {notice}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Hidden scratch canvas for frame export and the canvas fallback recorder */}
                        <canvas ref={canvasRef} className="hidden" />

                        {/* Mounted INSIDE the stage: in fullscreen only this subtree is painted */}
                        <ClassLabelDialog
                            open={pending !== null}
                            title={pending?.kind === "clip" ? "Label this clip" : "Label this frame"}
                            subtitle={
                                pending?.kind === "clip"
                                    ? `${formatTime(pending.startS)} – ${formatTime(pending.endS)} from ${pending.source.name}`
                                    : pending
                                      ? `Frame at ${formatTime(pending.timeS)} from ${pending.source.name}`
                                      : undefined
                            }
                            preview={pending ? { kind: pending.kind, url: pending.previewUrl } : null}
                            classes={classes}
                            isSaving={isSaving}
                            onSelect={(type) => void saveCapture(type)}
                            onCancel={discardPending}
                        />
                    </div>

                    {/* Action bar with the on-screen equivalents */}
                    <div className="flex flex-col sm:flex-row items-stretch gap-3">
                        <button
                            onClick={() => void captureFrame()}
                            disabled={!selected || !!recording || !!pending}
                            className="flex-1 py-3.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 bg-[#00DF89] hover:bg-[#00DF89]/90 text-slate-950 shadow-md shadow-[#00DF89]/20 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                        >
                            <Camera className="w-4 h-4" />
                            Capture frame at {formatTime(currentTime)}
                            <kbd className="bg-black/10 rounded px-1.5 py-0.5 font-mono text-[10px]">S</kbd>
                        </button>
                        <button
                            onClick={() => void captureClip()}
                            disabled={!selected || !!recording || !!pending}
                            className="flex-1 py-3.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 bg-[#0B1528] hover:bg-[#162238] text-white transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                        >
                            <Scissors className="w-4 h-4" />
                            Save clip{clipWindow ? ` ${formatTime(clipWindow.start)} – ${formatTime(clipWindow.end)}` : ""}
                            <kbd className="bg-white/15 rounded px-1.5 py-0.5 font-mono text-[10px]">V</kbd>
                        </button>
                    </div>

                    {/* Saved captures for this video */}
                    <div className="bg-white rounded-[22px] border border-[#E2E8F0] shadow-sm">
                        <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
                            <h2 className="text-sm font-extrabold text-[#0F172A]">
                                Validated images from this video
                            </h2>
                            <span className="text-[11px] font-bold text-[#64748B] font-mono">
                                {annotations.length} saved
                            </span>
                        </div>
                        {annotations.length === 0 ? (
                            <p className="px-5 py-10 text-center text-xs font-semibold text-[#94A3B8]">
                                Nothing captured yet. Play the video and press <kbd className="bg-[#F1F5F9] border border-[#E2E8F0] rounded px-1.5 py-0.5 font-mono text-[10px] text-[#0F172A]">S</kbd> or <kbd className="bg-[#F1F5F9] border border-[#E2E8F0] rounded px-1.5 py-0.5 font-mono text-[10px] text-[#0F172A]">V</kbd>.
                            </p>
                        ) : (
                            <ul className="grid grid-cols-2 md:grid-cols-3 gap-4 p-5">
                                {annotations.map((a) => (
                                    <li key={a.id} className="rounded-2xl border border-[#E2E8F0] overflow-hidden bg-white group">
                                        <div className="aspect-video bg-[#0B1528] relative">
                                            {a.kind === "frame" ? (
                                                <img src={a.media_url} alt={formatDetectionTypeLabel(a.detection_type)} loading="lazy" className="w-full h-full object-cover" />
                                            ) : (
                                                <video
                                                    src={a.media_url}
                                                    muted
                                                    data-silent=""
                                                    onVolumeChange={(e) => {
                                                        if (!e.currentTarget.muted) e.currentTarget.muted = true;
                                                    }}
                                                    playsInline
                                                    preload="metadata"
                                                    controls
                                                    className="w-full h-full object-cover"
                                                />
                                            )}
                                            <span className="absolute top-2 left-2 bg-[#0B1528]/85 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                                                {a.kind === "frame" ? <Camera className="w-3 h-3" /> : <Film className="w-3 h-3" />}
                                                {a.kind === "frame" ? "FRAME" : "CLIP"}
                                            </span>
                                        </div>
                                        <div className="p-3 flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-[#0F172A] truncate">{formatDetectionTypeLabel(a.detection_type)}</p>
                                                <p className="text-[10px] font-mono text-[#94A3B8] mt-0.5">
                                                    {a.kind === "frame"
                                                        ? `at ${formatTime(a.video_time_s)}`
                                                        : `${formatTime(a.clip_start_s ?? 0)} – ${formatTime(a.clip_end_s ?? 0)}`}
                                                    {" · "}
                                                    {formatBytes(a.byte_size)}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => void deleteAnnotation(a.id)}
                                                aria-label="Delete"
                                                className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-colors cursor-pointer shrink-0"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>

        </div>
    );
}

function VideoRow({
    video,
    active,
    onSelect,
    label,
    indented = false,
}: {
    video: SourceVideo;
    active: boolean;
    onSelect: () => void;
    /** Shown in place of the full name, e.g. "Part 2 of 3" under its video's heading. */
    label?: string;
    indented?: boolean;
}) {
    return (
        <li>
            <button
                onClick={onSelect}
                className={cn(
                    "w-full text-left py-3 pr-4 flex items-start gap-3 transition-colors cursor-pointer",
                    indented ? "pl-8" : "pl-4",
                    active ? "bg-[#E6FAF2]" : "hover:bg-[#F8FAFC]"
                )}
            >
                <div
                    className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border",
                        active ? "bg-[#00DF89] text-slate-950 border-[#00DF89]" : "bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]"
                    )}
                >
                    <Film className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                    <p className="text-xs font-bold text-[#0F172A] truncate">{label ?? video.name}</p>
                    <p className="text-[10px] font-medium text-[#64748B] truncate mt-0.5">{video.detail}</p>
                </div>
            </button>
        </li>
    );
}
