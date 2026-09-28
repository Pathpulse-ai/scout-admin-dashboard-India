import { Submission, VideoCapture } from "@/types";

/**
 * Captures from Video annotation, shaped for the same UI as scout cases.
 *
 * A capture is filed as validated evidence the moment it is saved, so the
 * Validated grid and the review page show it exactly like any other validated
 * image or video. Mapping it into the Submission shape here means neither
 * page needs a second card or a second media block. Client-safe: no server
 * imports.
 */

/** One row of /api/annotations, as the API returns it. */
export interface VideoAnnotationItem {
    id: string;
    kind: "frame" | "clip";
    detection_type: string;
    source_kind: "library" | "submission";
    source_video_id: string | null;
    source_submission_id: string | null;
    source_name: string | null;
    video_time_s: number;
    clip_start_s: number | null;
    clip_end_s: number | null;
    content_type: string;
    byte_size: number;
    created_at: string;
    review_status: string | null;
    media_url: string;
    /** From the scout submission the video came from, when it came from one. */
    source_username: string | null;
    source_country_code: string | null;
    source_latitude: number | null;
    source_longitude: number | null;
}

/** Query parameter that tells the review page to load a capture, not a case. */
export const CAPTURE_SOURCE_PARAM = "source";
export const CAPTURE_SOURCE_VALUE = "capture";

export function captureToSubmission(a: VideoAnnotationItem): Submission {
    const isFrame = a.kind === "frame";
    const capture: VideoCapture = {
        kind: a.kind,
        source_kind: a.source_kind,
        source_video_id: a.source_video_id,
        source_submission_id: a.source_submission_id,
        source_name: a.source_name,
        video_time_s: a.video_time_s,
        clip_start_s: a.clip_start_s,
        clip_end_s: a.clip_end_s,
        content_type: a.content_type,
        byte_size: a.byte_size,
        media_url: a.media_url,
    };

    return {
        id: a.id,
        account_id: "",
        username: a.source_username ?? "",
        user_name: null,
        user_country: null,
        user_banned: false,
        submission_type: isFrame ? "image" : "video",
        detection_type: a.detection_type,
        beats_earned: 0,
        latitude: a.source_latitude,
        longitude: a.source_longitude,
        // A capture is evidence from the moment the officer saved it.
        captured_at: a.created_at,
        verification_status: "verified",
        verified_at: a.created_at,
        rejection_reason: null,
        frame_count: isFrame ? 1 : 0,
        country_code: a.source_country_code,
        primary_image_id: isFrame ? a.id : null,
        processing_metadata: null,
        review_status: a.review_status ?? "VALIDATED",
        court_ready: a.review_status === "COURT_READY",
        created_at: a.created_at,
        video_asset: isFrame ? null : { url: a.media_url },
        has_video: !isFrame,
        has_images: isFrame,
        images: isFrame
            ? [
                  {
                      id: a.id,
                      submission_id: a.id,
                      frame_index: 0,
                      is_primary: true,
                      image_url: a.media_url,
                      thumbnail_url: a.media_url,
                      latitude: a.source_latitude,
                      longitude: a.source_longitude,
                      captured_at: a.created_at,
                      detection_data: null,
                      image_metadata: null,
                  },
              ]
            : [],
        capture,
    };
}

/** "0:12" from seconds. */
export function formatClock(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
}

/** Where in its source video a capture was taken: "at 0:12" or "0:02–0:22". */
export function describeCapturePosition(c: VideoCapture): string {
    if (c.kind === "frame") return `at ${formatClock(c.video_time_s)}`;
    return `${formatClock(c.clip_start_s ?? 0)}–${formatClock(c.clip_end_s ?? 0)}`;
}

/**
 * Merge captures into a page of validated cases by time, newest first.
 *
 * Both inputs are already newest-first: cases by captured_at, captures by
 * created_at. When more cases are still to load, captures older than the last
 * loaded case are held back so they surface in their place rather than
 * bunching at the end of a partial list.
 */
export function mergeCapturesByTime(
    cases: Submission[],
    captures: Submission[],
    moreCasesToLoad: boolean
): Submission[] {
    const out: Submission[] = [];
    let ci = 0;
    for (const s of cases) {
        const t = Date.parse(s.captured_at);
        while (ci < captures.length && Date.parse(captures[ci].captured_at) >= t) {
            out.push(captures[ci++]);
        }
        out.push(s);
    }
    if (!moreCasesToLoad) {
        while (ci < captures.length) out.push(captures[ci++]);
    }
    return out;
}
