/**
 * The browser's view of the Video Library.
 *
 * Videos live in S3 and are catalogued in Postgres. This module lists and
 * removes them; uploads go through lib/multipartUpload. Client-safe: no
 * server imports.
 */
import { LibraryFragmentRecord, LibraryVideoRecord } from "@/types";

/** One part of a split video: a time range of the same stored file. */
export interface LibraryFragment {
    id: string;
    /** 1-based order within the video. */
    position: number;
    startS: number;
    endS: number;
}

export interface LibraryVideo {
    id: string;
    /** Display name entered by the officer. */
    name: string;
    /** Original file name, kept for reference. */
    fileName: string;
    /** MIME type stored on the object, e.g. "video/mp4". */
    type: string;
    /** Size in bytes. */
    size: number;
    source: "device" | "drive";
    /** Length in seconds, known once the video has been split. */
    durationS: number | null;
    /** Empty when the video has not been split into parts. */
    fragments: LibraryFragment[];
    /** ISO timestamp of when the upload finished. */
    createdAt: string;
    /** Presigned playback URL. Valid for hours; a reload fetches a fresh one. */
    url: string;
}

export function toLibraryFragment(record: LibraryFragmentRecord): LibraryFragment {
    return { id: record.id, position: record.position, startS: record.start_s, endS: record.end_s };
}

export function toLibraryVideo(record: LibraryVideoRecord): LibraryVideo {
    return {
        id: record.id,
        name: record.name,
        fileName: record.file_name,
        type: record.content_type,
        size: record.size_bytes,
        source: record.source,
        durationS: record.duration_s ?? null,
        fragments: (record.fragments ?? []).map(toLibraryFragment),
        createdAt: record.ready_at ?? record.created_at,
        url: record.url ?? "",
    };
}

/**
 * Split a video into equal parts, replacing any earlier split. Parts are
 * time ranges of the same file; nothing is copied, and captures already
 * taken stay with the video.
 */
export async function splitVideo(id: string, parts: number, durationS: number): Promise<LibraryVideo> {
    const res = await fetch(`/api/library/videos/${id}/fragments`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parts, duration_s: durationS }),
    });
    if (!res.ok) throw new Error(await errorMessage(res, "Could not split the video."));
    const data = (await res.json()) as { video: LibraryVideoRecord };
    return toLibraryVideo(data.video);
}

export async function unsplitVideo(id: string): Promise<LibraryVideo> {
    const res = await fetch(`/api/library/videos/${id}/fragments`, { method: "DELETE" });
    if (!res.ok) throw new Error(await errorMessage(res, "Could not remove the split."));
    const data = (await res.json()) as { video: LibraryVideoRecord };
    return toLibraryVideo(data.video);
}

/** "1:02:03" past an hour, else "12:34". */
export function formatClockLong(seconds: number): string {
    const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** The API's error message when it sent one, else a fallback with the status. */
export async function errorMessage(res: Response, fallback: string): Promise<string> {
    try {
        const body = (await res.json()) as { error?: unknown };
        if (typeof body?.error === "string" && body.error) return body.error;
    } catch {
        // not JSON
    }
    return `${fallback} (HTTP ${res.status})`;
}

/** Every finished video, newest first. */
export async function listVideos(): Promise<LibraryVideo[]> {
    const res = await fetch("/api/library/videos", { cache: "no-store" });
    if (!res.ok) throw new Error(await errorMessage(res, "Could not load the video library."));
    const data = (await res.json()) as { videos: LibraryVideoRecord[] };
    return (data.videos ?? []).filter((v) => v.url).map(toLibraryVideo);
}

export async function removeVideo(id: string): Promise<void> {
    const res = await fetch(`/api/library/videos/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await errorMessage(res, "Could not remove this video."));
}

/** Human-readable size: "0 MB", "12.4 MB", "1.2 GB". */
export function formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) return "0 MB";
    const mb = bytes / (1024 * 1024);
    // Round before picking the unit, so 1023.99 MB reads "1.0 GB" rather than "1024 MB".
    const gb = Number((mb / 1024).toFixed(1));
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const wholeMb = Math.round(mb);
    if (wholeMb >= 100) return `${wholeMb} MB`;
    const tenthMb = Number(mb.toFixed(1));
    if (tenthMb >= 1) return `${tenthMb.toFixed(1)} MB`;
    return `${Math.min(1023, Math.max(1, Math.round(bytes / 1024)))} KB`;
}

/**
 * True when the file is a video. The MIME type is the first check; some
 * platforms leave it empty, so the extension is the fallback.
 */
export function isVideoFile(file: { type: string; name: string }): boolean {
    if (file.type) return file.type.startsWith("video/");
    return /\.(mp4|mov|m4v|webm|mkv|avi|mpg|mpeg|3gp|ogv|ts)$/i.test(file.name);
}

/** A default display name from the file name, without its extension. */
export function nameFromFile(fileName: string): string {
    return fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
}
