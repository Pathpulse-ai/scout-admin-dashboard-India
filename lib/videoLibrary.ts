/**
 * Browser-side store for the Video Library page.
 *
 * There is no upload API yet, so videos are kept in the browser's IndexedDB.
 * localStorage cannot hold video blobs, and plain component state would lose
 * the library on refresh. Each record carries the original File as a Blob so
 * a preview can be rebuilt with URL.createObjectURL on the next visit.
 */

const DB_NAME = "pathpulse-video-library";
const DB_VERSION = 1;
const STORE = "videos";

export interface StoredVideo {
    id: string;
    /** Display name entered by the user. */
    name: string;
    /** Original file name, kept for reference. */
    fileName: string;
    /** MIME type reported by the browser, e.g. "video/mp4". */
    type: string;
    /** Size in bytes. */
    size: number;
    /** ISO timestamp of when it was added. */
    createdAt: string;
    blob: Blob;
}

function isIndexedDbAvailable() {
    return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (!isIndexedDbAvailable()) {
            reject(new Error("This browser does not support local video storage."));
            return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE)) {
                db.createObjectStore(STORE, { keyPath: "id" });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Could not open the video library."));
        request.onblocked = () => reject(new Error("The video library is open in another tab."));
    });
}

/** Runs one request inside a transaction and resolves with its result. */
async function withStore<T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
    const db = await openDb();
    try {
        return await new Promise<T>((resolve, reject) => {
            const tx = db.transaction(STORE, mode);
            const request = action(tx.objectStore(STORE));
            let result: T | undefined;
            request.onsuccess = () => {
                result = request.result;
            };
            request.onerror = () => reject(request.error ?? new Error("Video library request failed."));
            // A write is only durable once the transaction commits. Chrome checks
            // storage quota at commit time and reports it on the transaction, so
            // resolving on the request alone would report a save that never landed.
            tx.oncomplete = () => resolve(result as T);
            tx.onabort = () =>
                reject(tx.error ?? request.error ?? new Error("Video library transaction aborted."));
            tx.onerror = () =>
                reject(tx.error ?? request.error ?? new Error("Video library transaction failed."));
        });
    } finally {
        db.close();
    }
}

/** Every stored video, newest first. */
export async function listVideos(): Promise<StoredVideo[]> {
    const rows = await withStore<StoredVideo[]>("readonly", (store) => store.getAll());
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveVideo(video: StoredVideo): Promise<void> {
    await withStore("readwrite", (store) => store.put(video));
}

export async function removeVideo(id: string): Promise<void> {
    await withStore("readwrite", (store) => store.delete(id));
}

export function newVideoId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return `vid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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
export function isVideoFile(file: File): boolean {
    if (file.type) return file.type.startsWith("video/");
    return /\.(mp4|mov|m4v|webm|mkv|avi|mpg|mpeg|3gp|ogv)$/i.test(file.name);
}

/** A default display name from the file name, without its extension. */
export function nameFromFile(fileName: string): string {
    return fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
}
