/**
 * Google Drive as a source for the Video Library.
 *
 * Two ways in, so the feature works before any Google Cloud setup exists:
 *
 * 1. The Google Drive picker. Needs an OAuth client id and an API key (see
 *    .env.example). The officer signs in, picks a video, and the browser
 *    reads it straight from the Drive API with the granted token.
 * 2. A pasted share link. Needs no credentials, but the file must be shared as
 *    "Anyone with the link". drive.google.com sends no CORS headers, so the
 *    bytes are read through /api/drive-import.
 *
 * Either way the result is a ByteSource the multipart uploader reads in
 * part-sized ranges, so a file of any size flows Drive to S3 through the
 * browser without ever being held whole. Client-safe: no server imports.
 */
import { ByteSource } from "./multipartUpload";
import { errorMessage } from "./videoLibrary";

export const DRIVE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
export const DRIVE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY ?? "";
/** The Cloud project number; lets the picker grant per-file access. */
export const DRIVE_APP_ID = process.env.NEXT_PUBLIC_GOOGLE_APP_ID ?? "";

const GSI_SRC = "https://accounts.google.com/gsi/client";
const GAPI_SRC = "https://apis.google.com/js/api.js";
const DRIVE_API = "https://www.googleapis.com/drive/v3/files";

/**
 * drive.file only reaches files the officer picked, which is all this page
 * needs, but the picker can only grant it when it knows the app. Without the
 * project number the read-only scope is the fallback.
 */
const PICKER_SCOPE = DRIVE_APP_ID
    ? "https://www.googleapis.com/auth/drive.file"
    : "https://www.googleapis.com/auth/drive.readonly";

/** Drive file ids are URL-safe base64; a real one is well over 10 characters. */
const DRIVE_FILE_ID = /^[A-Za-z0-9_-]{10,}$/;

export function isDrivePickerConfigured(): boolean {
    return Boolean(DRIVE_CLIENT_ID && DRIVE_API_KEY);
}

/** A file chosen from Drive, by picker or by link. */
export interface DrivePick {
    id: string;
    name: string;
    mimeType: string;
    sizeBytes: number | null;
}

/**
 * The file id from any of the link shapes Drive hands out:
 *   https://drive.google.com/file/d/<id>/view?usp=sharing
 *   https://drive.google.com/open?id=<id>
 *   https://drive.google.com/uc?id=<id>&export=download
 *   https://drive.usercontent.google.com/download?id=<id>
 * or a bare id. Null when it is none of those.
 */
export function parseDriveFileId(input: string): string | null {
    const raw = input.trim();
    if (!raw) return null;
    if (DRIVE_FILE_ID.test(raw)) return raw;

    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        return null;
    }
    const host = url.hostname.toLowerCase();
    const isDriveHost =
        host === "drive.google.com" || host === "docs.google.com" || host === "drive.usercontent.google.com";
    if (!isDriveHost) return null;

    const inPath = url.pathname.match(/\/(?:file\/d|d)\/([A-Za-z0-9_-]{10,})/);
    if (inPath) return inPath[1];

    const inQuery = url.searchParams.get("id");
    if (inQuery && DRIVE_FILE_ID.test(inQuery)) return inQuery;
    return null;
}

// ---------------------------------------------------------------------------
// Google scripts. Loaded on first use, never at page load: most visits to the
// library never touch Drive.

declare global {
    interface Window {
        google?: GoogleGlobal;
        gapi?: { load(name: string, options: { callback: () => void; onerror?: () => void }): void };
    }
}

interface GoogleGlobal {
    accounts?: {
        oauth2: {
            initTokenClient(config: {
                client_id: string;
                scope: string;
                callback: (response: GoogleTokenResponse) => void;
                error_callback?: (error: { type?: string; message?: string }) => void;
            }): { requestAccessToken(overrides?: { prompt?: string }): void };
        };
    };
    picker?: GooglePickerNamespace;
}

interface GoogleTokenResponse {
    access_token?: string;
    error?: string;
    error_description?: string;
}

interface GooglePickerDoc {
    id: string;
    name: string;
    mimeType: string;
    sizeBytes?: number;
}

interface GooglePickerResponse {
    action: string;
    docs?: GooglePickerDoc[];
}

interface GooglePickerView {
    setIncludeFolders(include: boolean): GooglePickerView;
    setMimeTypes(mimeTypes: string): GooglePickerView;
}

interface GooglePickerBuilder {
    addView(view: GooglePickerView): GooglePickerBuilder;
    setOAuthToken(token: string): GooglePickerBuilder;
    setDeveloperKey(key: string): GooglePickerBuilder;
    setAppId(appId: string): GooglePickerBuilder;
    setTitle(title: string): GooglePickerBuilder;
    enableFeature(feature: string): GooglePickerBuilder;
    setCallback(callback: (data: GooglePickerResponse) => void): GooglePickerBuilder;
    build(): { setVisible(visible: boolean): void };
}

interface GooglePickerNamespace {
    PickerBuilder: new () => GooglePickerBuilder;
    DocsView: new (viewId?: string) => GooglePickerView;
    ViewId: { DOCS: string; DOCS_VIDEOS: string };
    Action: { PICKED: string; CANCEL: string };
    Feature: { SUPPORT_DRIVES: string };
}

function loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
        if (existing) {
            if (existing.dataset.loaded === "true") {
                resolve();
                return;
            }
            existing.addEventListener("load", () => resolve(), { once: true });
            existing.addEventListener("error", () => reject(new Error("Google's scripts could not be loaded.")), {
                once: true,
            });
            return;
        }
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.onload = () => {
            script.dataset.loaded = "true";
            resolve();
        };
        script.onerror = () => reject(new Error("Google's scripts could not be loaded. Check the connection."));
        document.head.appendChild(script);
    });
}

/** Sign the officer in and get a token the picker and the reads can use. */
export async function requestDriveAccessToken(): Promise<string> {
    if (!isDrivePickerConfigured()) {
        throw new Error("Google Drive browsing is not configured on this console.");
    }
    await loadScript(GSI_SRC);
    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) throw new Error("Google sign-in could not be loaded.");

    return new Promise((resolve, reject) => {
        const client = oauth2.initTokenClient({
            client_id: DRIVE_CLIENT_ID,
            scope: PICKER_SCOPE,
            callback: (response) => {
                if (response.access_token) resolve(response.access_token);
                else reject(new Error(response.error_description || response.error || "Google sign-in was cancelled."));
            },
            error_callback: (error) => reject(new Error(error?.message || "Google sign-in was cancelled.")),
        });
        client.requestAccessToken();
    });
}

/** Open the Drive picker on the officer's videos; null when they close it. */
export async function pickDriveVideo(token: string): Promise<DrivePick | null> {
    await loadScript(GAPI_SRC);
    const gapi = window.gapi;
    if (!gapi) throw new Error("The Google Drive picker could not be loaded.");
    await new Promise<void>((resolve, reject) =>
        gapi.load("picker", {
            callback: resolve,
            onerror: () => reject(new Error("The Google Drive picker could not be loaded.")),
        })
    );
    const picker = window.google?.picker;
    if (!picker) throw new Error("The Google Drive picker could not be loaded.");

    return new Promise((resolve) => {
        const view = new picker.DocsView(picker.ViewId.DOCS_VIDEOS).setIncludeFolders(true);
        const builder = new picker.PickerBuilder()
            .addView(view)
            .setOAuthToken(token)
            .setDeveloperKey(DRIVE_API_KEY)
            .setTitle("Choose a video from Google Drive")
            .enableFeature(picker.Feature.SUPPORT_DRIVES)
            .setCallback((data) => {
                if (data.action === picker.Action.PICKED) {
                    const doc = data.docs?.[0];
                    resolve(
                        doc
                            ? {
                                  id: doc.id,
                                  name: doc.name,
                                  mimeType: doc.mimeType,
                                  sizeBytes: typeof doc.sizeBytes === "number" ? doc.sizeBytes : null,
                              }
                            : null
                    );
                } else if (data.action === picker.Action.CANCEL) {
                    resolve(null);
                }
            });
        if (DRIVE_APP_ID) builder.setAppId(DRIVE_APP_ID);
        builder.build().setVisible(true);
    });
}

function decodeHeaderName(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

/** A ranged read that must come back as exactly the bytes asked for. */
async function readRange(
    url: string,
    start: number,
    end: number,
    headers: Record<string, string>,
    signal: AbortSignal
): Promise<ArrayBuffer> {
    const res = await fetch(url, { headers: { ...headers, Range: `bytes=${start}-${end - 1}` }, signal });
    if (res.status !== 206) {
        if (res.ok) {
            // The whole file came back: the source ignores Range.
            await res.body?.cancel().catch(() => {});
            throw new Error("Google Drive did not serve the file in parts.");
        }
        throw new Error(await errorMessage(res, "Google Drive refused a read."));
    }
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength !== end - start) {
        throw new Error(`Google Drive returned ${buffer.byteLength} bytes where ${end - start} were expected.`);
    }
    return buffer;
}

/**
 * The picked file as a ByteSource read straight from the Drive API with the
 * officer's token. The size comes from the picker, or from the file's
 * metadata when the picker did not say.
 */
export async function driveApiByteSource(pick: DrivePick, token: string): Promise<ByteSource> {
    const auth = { Authorization: `Bearer ${token}` };
    let { name, mimeType, sizeBytes } = pick;
    if (!sizeBytes || !name) {
        const res = await fetch(`${DRIVE_API}/${encodeURIComponent(pick.id)}?fields=name,size,mimeType&supportsAllDrives=true`, {
            headers: auth,
        });
        if (!res.ok) throw new Error(await errorMessage(res, "Could not read the file's details from Google Drive."));
        const meta = (await res.json()) as { name?: string; size?: string; mimeType?: string };
        name = name || meta.name || `google-drive-${pick.id}`;
        mimeType = mimeType || meta.mimeType || "";
        sizeBytes = Number(meta.size) || sizeBytes;
    }
    if (!sizeBytes) throw new Error("Google Drive did not report the file's size.");

    const mediaUrl = `${DRIVE_API}/${encodeURIComponent(pick.id)}?alt=media&supportsAllDrives=true`;
    return {
        name,
        type: mimeType,
        size: sizeBytes,
        fingerprint: `drive:${pick.id}:${sizeBytes}`,
        read: (start, end, signal) => readRange(mediaUrl, start, end, auth, signal),
    };
}

/**
 * A shared file as a ByteSource read through /api/drive-import, which asks
 * Google for one part-sized range at a time.
 */
export async function driveLinkByteSource(id: string): Promise<ByteSource> {
    const probe = await fetch(`/api/drive-import?id=${encodeURIComponent(id)}&probe=1`);
    if (!probe.ok) throw new Error(await errorMessage(probe, "Google Drive could not be reached."));
    const info = (await probe.json()) as { name: string | null; type: string | null; size: number | null; ranges: boolean };
    if (!info.ranges || !info.size) {
        throw new Error(
            "Google Drive will not serve this file in parts, so it cannot be imported by link. Use Browse Google Drive, or download it and upload it from this device."
        );
    }
    const url = `/api/drive-import?id=${encodeURIComponent(id)}`;
    const name = (info.name ? decodeHeaderName(info.name) : "") || `google-drive-${id}`;
    return {
        name,
        type: info.type ?? "",
        size: info.size,
        fingerprint: `drive:${id}:${info.size}`,
        read: (start, end, signal) => readRange(url, start, end, {}, signal),
    };
}
