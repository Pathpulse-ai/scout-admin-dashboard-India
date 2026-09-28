/**
 * Browser-side multipart upload into the Video Library.
 *
 * A 2 to 3 hour recording is tens of gigabytes, so the bytes never touch the
 * console's server: the server only opens the upload, signs part URLs and
 * completes it. This module reads the source in part-sized slices, PUTs
 * several parts at once straight to S3, retries each part on its own, and
 * resumes an upload of the same bytes that an earlier attempt left open.
 *
 * Client-safe: no server imports.
 */
import { LibraryVideoRecord } from "@/types";
import { errorMessage } from "./videoLibrary";

/** Anything the uploader can read in ranges: a File, or a Drive file. */
export interface ByteSource {
    name: string;
    type: string;
    size: number;
    /** Stable identity of the bytes, so the same source resumes the same upload. */
    fingerprint: string;
    /** Bytes [start, end). */
    read(start: number, end: number, signal: AbortSignal): Promise<Blob | ArrayBuffer>;
}

/** A file chosen from disk. slice() reads lazily, so nothing is held in memory. */
export function fileByteSource(file: File): ByteSource {
    return {
        name: file.name,
        type: file.type,
        size: file.size,
        fingerprint: `file:${file.name}:${file.size}:${file.lastModified}`,
        read: async (start, end) => file.slice(start, end),
    };
}

export interface UploadProgress {
    uploadedBytes: number;
    totalBytes: number;
    partsDone: number;
    partCount: number;
    /** Null until enough has moved to estimate. */
    bytesPerSecond: number | null;
    /** True when parts from an earlier attempt were reused. */
    resumed: boolean;
    phase: "starting" | "uploading" | "finishing";
}

export type UploadErrorKind = "config" | "network" | "server" | "aborted";

export class UploadError extends Error {
    constructor(message: string, readonly kind: UploadErrorKind) {
        super(message);
        this.name = "UploadError";
    }
}

interface BeginResponse {
    upload: {
        id: string;
        key: string;
        upload_id: string;
        part_size: number;
        part_count: number;
        size_bytes: number;
    };
    uploaded_parts: { part_number: number; etag: string; size: number }[];
    resumed: boolean;
}

/** Parts in flight at once. Memory held is roughly this many part sizes. */
const CONCURRENCY = 4;
/** Presigned URLs fetched per signing call; ahead of the workers, never all at once. */
const SIGN_BATCH = 20;
const MAX_ATTEMPTS = 5;
/** Window over which the transfer rate is averaged. */
const RATE_WINDOW_MS = 10_000;

const JSON_HEADERS = { "Content-Type": "application/json" };

function sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => {
            signal.removeEventListener("abort", onAbort);
            resolve();
        }, ms);
        const onAbort = () => {
            window.clearTimeout(timer);
            reject(new UploadError("Upload cancelled.", "aborted"));
        };
        signal.addEventListener("abort", onAbort, { once: true });
    });
}

/**
 * One part, by XMLHttpRequest rather than fetch because only XHR reports
 * upload progress. Resolves with the ETag S3 assigned to the part.
 */
function putPart(
    url: string,
    body: Blob | ArrayBuffer,
    signal: AbortSignal,
    onLoaded: (loaded: number) => void
): Promise<string> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const onAbort = () => xhr.abort();
        const settle = (fn: () => void) => {
            signal.removeEventListener("abort", onAbort);
            fn();
        };
        if (signal.aborted) {
            reject(new UploadError("Upload cancelled.", "aborted"));
            return;
        }
        signal.addEventListener("abort", onAbort, { once: true });

        xhr.open("PUT", url, true);
        xhr.upload.onprogress = (e) => onLoaded(e.loaded);
        xhr.onload = () =>
            settle(() => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    const etag = xhr.getResponseHeader("ETag");
                    if (!etag) {
                        reject(
                            new UploadError(
                                "S3 accepted the part but the bucket's CORS does not expose the ETag header, so the upload cannot be completed. Add ETag to ExposeHeaders in the bucket's CORS configuration.",
                                "config"
                            )
                        );
                        return;
                    }
                    resolve(etag);
                } else if (xhr.status === 403) {
                    // Usually an expired URL; the caller retries with a fresh one.
                    reject(new UploadError("S3 refused the upload URL (HTTP 403).", "server"));
                } else {
                    reject(new UploadError(`S3 returned HTTP ${xhr.status} for a part.`, "server"));
                }
            });
        xhr.onerror = () =>
            settle(() =>
                reject(
                    new UploadError(
                        "The upload was blocked before reaching S3. Check the connection, and that the bucket's CORS allows PUT from this site.",
                        "network"
                    )
                )
            );
        xhr.onabort = () => settle(() => reject(new UploadError("Upload cancelled.", "aborted")));
        xhr.send(body);
    });
}

export interface UploadOptions {
    source: ByteSource;
    /** Display name for the library. */
    name: string;
    origin: "device" | "drive";
    signal: AbortSignal;
    /** The library upload id, as soon as the server has opened the upload. */
    onStarted?: (uploadId: string) => void;
    onProgress?: (progress: UploadProgress) => void;
}

export async function uploadToLibrary(options: UploadOptions): Promise<LibraryVideoRecord> {
    const { source, name, origin, signal, onStarted, onProgress } = options;

    // One failure stops every worker: the outer signal is the officer's
    // cancel, this one is ours.
    const inner = new AbortController();
    const onOuterAbort = () => inner.abort();
    if (signal.aborted) throw new UploadError("Upload cancelled.", "aborted");
    signal.addEventListener("abort", onOuterAbort, { once: true });

    try {
        onProgress?.({
            uploadedBytes: 0,
            totalBytes: source.size,
            partsDone: 0,
            partCount: 0,
            bytesPerSecond: null,
            resumed: false,
            phase: "starting",
        });

        const beginRes = await fetch("/api/library/uploads", {
            method: "POST",
            headers: JSON_HEADERS,
            signal: inner.signal,
            body: JSON.stringify({
                name,
                file_name: source.name,
                content_type: source.type,
                size_bytes: source.size,
                source: origin,
                fingerprint: source.fingerprint,
            }),
        });
        if (!beginRes.ok) throw new UploadError(await errorMessage(beginRes, "Could not start the upload."), "server");
        const begin = (await beginRes.json()) as BeginResponse;
        const { upload } = begin;
        onStarted?.(upload.id);

        // What an earlier attempt already got in.
        const etags = new Map<number, string>();
        let doneBytes = 0;
        for (const p of begin.uploaded_parts) {
            if (p.part_number >= 1 && p.part_number <= upload.part_count && !etags.has(p.part_number)) {
                etags.set(p.part_number, p.etag);
                doneBytes += p.size;
            }
        }
        const pending: number[] = [];
        for (let n = 1; n <= upload.part_count; n++) if (!etags.has(n)) pending.push(n);

        // Progress: finished parts plus whatever each in-flight request has sent.
        const inflight = new Map<number, number>();
        const samples: Array<[number, number]> = [];
        const report = (phase: UploadProgress["phase"]) => {
            let uploaded = doneBytes;
            inflight.forEach((loaded) => {
                uploaded += loaded;
            });
            const now = performance.now();
            samples.push([now, uploaded]);
            while (samples.length > 2 && now - samples[0][0] > RATE_WINDOW_MS) samples.shift();
            const [t0, b0] = samples[0];
            const elapsed = now - t0;
            const bytesPerSecond = elapsed >= 1000 && uploaded > b0 ? ((uploaded - b0) * 1000) / elapsed : null;
            onProgress?.({
                uploadedBytes: uploaded,
                totalBytes: upload.size_bytes,
                partsDone: etags.size,
                partCount: upload.part_count,
                bytesPerSecond,
                resumed: begin.resumed,
                phase,
            });
        };
        report("uploading");

        // Presigned URLs, minted a batch ahead of the workers. One signing
        // call runs at a time so parallel workers share it.
        const urls = new Map<number, string>();
        let signing: Promise<void> | null = null;
        const urlFor = async (n: number): Promise<string> => {
            for (;;) {
                const cached = urls.get(n);
                if (cached) return cached;
                if (signing) {
                    await signing;
                    continue;
                }
                const batch = pending.filter((p) => p >= n && !urls.has(p)).slice(0, SIGN_BATCH);
                if (!batch.includes(n)) batch.unshift(n);
                signing = (async () => {
                    const res = await fetch(`/api/library/uploads/${upload.id}/parts`, {
                        method: "POST",
                        headers: JSON_HEADERS,
                        signal: inner.signal,
                        body: JSON.stringify({ part_numbers: batch }),
                    });
                    if (!res.ok) throw new UploadError(await errorMessage(res, "Could not sign the upload URLs."), "server");
                    const data = (await res.json()) as { urls: Record<string, string> };
                    for (const [k, v] of Object.entries(data.urls)) urls.set(Number(k), v);
                })().finally(() => {
                    signing = null;
                });
                await signing;
            }
        };

        let cursor = 0;
        const worker = async () => {
            for (;;) {
                if (inner.signal.aborted) throw new UploadError("Upload cancelled.", "aborted");
                const index = cursor++;
                if (index >= pending.length) return;
                const n = pending[index];
                const start = (n - 1) * upload.part_size;
                const end = Math.min(upload.size_bytes, n * upload.part_size);
                const body = await source.read(start, end, inner.signal);

                for (let attempt = 1; ; attempt++) {
                    try {
                        const url = await urlFor(n);
                        const etag = await putPart(url, body, inner.signal, (loaded) => {
                            inflight.set(n, loaded);
                            report("uploading");
                        });
                        inflight.delete(n);
                        etags.set(n, etag);
                        doneBytes += end - start;
                        report("uploading");
                        break;
                    } catch (error) {
                        inflight.delete(n);
                        if (inner.signal.aborted) throw new UploadError("Upload cancelled.", "aborted");
                        const kind = error instanceof UploadError ? error.kind : "network";
                        if (kind === "aborted" || kind === "config" || attempt >= MAX_ATTEMPTS) throw error;
                        // Expired or refused URL: sign a fresh one on the next try.
                        urls.delete(n);
                        await sleep(Math.min(30_000, 1000 * 2 ** (attempt - 1)), inner.signal);
                    }
                }
            }
        };

        try {
            await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker));
        } catch (error) {
            // Stop the other workers' requests; their parts stay in S3 for a resume.
            inner.abort();
            throw error;
        }

        report("finishing");
        const parts = Array.from(etags.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([part_number, etag]) => ({ part_number, etag }));
        const completeRes = await fetch(`/api/library/uploads/${upload.id}/complete`, {
            method: "POST",
            headers: JSON_HEADERS,
            body: JSON.stringify({ parts }),
        });
        if (!completeRes.ok) {
            throw new UploadError(await errorMessage(completeRes, "Could not finish the upload."), "server");
        }
        const data = (await completeRes.json()) as { video: LibraryVideoRecord };
        return data.video;
    } catch (error) {
        if ((error as Error)?.name === "AbortError" || signal.aborted) {
            throw new UploadError("Upload cancelled.", "aborted");
        }
        throw error;
    } finally {
        signal.removeEventListener("abort", onOuterAbort);
    }
}

/** Drop an upload the officer cancelled, so S3 stops holding its parts. */
export async function abortLibraryUpload(uploadId: string): Promise<void> {
    await fetch(`/api/library/uploads/${uploadId}`, { method: "DELETE" }).catch(() => {});
}
