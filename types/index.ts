export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export interface SubmissionImage {
    id: string;
    submission_id: string;
    frame_index: number;
    is_primary: boolean;
    image_url: string;
    thumbnail_url: string;
    latitude: number | null;
    longitude: number | null;
    captured_at: string | null;
    detection_data: Record<string, unknown> | null;
    image_metadata: Record<string, unknown> | null;
}

export interface VideoAsset {
    url: string;
    thumbnail_url?: string;
}

export interface Submission {
    id: string;
    account_id: string;
    username: string;
    user_name: string | null;
    user_country: string | null;
    user_banned: boolean;
    submission_type: string;
    detection_type: string;
    beats_earned: number;
    latitude: number | null;
    longitude: number | null;
    captured_at: string;
    verification_status: VerificationStatus;
    verified_at: string | null;
    rejection_reason: string | null;
    frame_count: number;
    country_code: string | null;
    primary_image_id: string | null;
    processing_metadata: Record<string, unknown> | null;
    /** 'COURT_READY' | 'VALIDATED', or null when the case was never validated. */
    review_status?: string | null;
    /** Convenience view of review_status; null when never reviewed. */
    court_ready?: boolean | null;
    created_at: string;
    video_asset: VideoAsset | null;
    has_video: boolean;
    has_images: boolean;
    images: SubmissionImage[];
    /**
     * Set when the record is a frame or clip filed from Video annotation.
     * It is shaped like a submission so the grid and the review page render
     * it with the same code, but it has no scout, earns no beats and is
     * validated the moment it is saved.
     */
    capture?: VideoCapture | null;
}

/** A frame or clip an officer captured on the Video annotation page. */
export interface VideoCapture {
    kind: 'frame' | 'clip';
    /** 'library' = an officer upload, 'submission' = a scout's video. */
    source_kind: 'library' | 'submission';
    source_video_id: string | null;
    source_submission_id: string | null;
    /** Display name of the video it was taken from. */
    source_name: string | null;
    /** Seconds into the video where the capture key was pressed. */
    video_time_s: number;
    clip_start_s: number | null;
    clip_end_s: number | null;
    content_type: string;
    byte_size: number;
    media_url: string;
}

export interface Stats {
    total_submissions: number;
    verified: number;
    rejected: number;
    pending: number;
    total_frames: number;
    total_videos?: number;
    /** Frames and clips filed from Video annotation; all are validated. */
    validated_captures?: number;
    detection_types: { detection_type: string; count: number }[];
}

export interface FraudEvent {
    id: string;
    user_id: string;
    username: string;
    email: string;
    country_code: string;
    trip_id: string;
    event_type: string;
    severity: string;
    details: Record<string, unknown> | null;
    created_at: string;
    trip_distance: number;
    trip_duration: number;
    brand: string;
    device_model: string;
}

export interface UserSearchItem {
    id: string;
    username: string;
    email: string;
    country: string;
    country_code: string;
    tier: string;
    submission_count: number;
    photo_url?: string | null;
    is_banned?: boolean;
}

export interface Country {
    country_code: string;
    country_name: string;
    count: number;
}

export interface DetectionTypeCount {
    detection_type: string;
    /** All-time size of the class; does not fall as cases are reviewed. */
    total: number;
    pending: number;
    verified?: number;
    rejected?: number;
    /** Verified cases whose primary frame was filed as court ready. */
    court_ready?: number;
    /** Frames and clips filed from Video annotation under this class. */
    captures?: number;
    /** Those captures that an officer went on to file as court ready. */
    captures_court_ready?: number;
}

export interface ScoutAnalytics {
    total_hours: number;
    total_km: number;
    total_userbase: number;
    total_countries: number;
    countries_data: {
        country_code: string;
        submission_count: number;
    }[];
}

/** One part of a split library video: a time range of the same stored file. */
export interface LibraryFragmentRecord {
    id: string;
    /** 1-based order within the video. */
    position: number;
    start_s: number;
    end_s: number;
}

/** One finished Video Library upload, as /api/library/videos returns it. */
export interface LibraryVideoRecord {
    id: string;
    name: string;
    file_name: string;
    content_type: string;
    size_bytes: number;
    /** 'device' = chosen from disk, 'drive' = imported from Google Drive. */
    source: 'device' | 'drive';
    /** Length in seconds, known once the video has been split. */
    duration_s: number | null;
    /** Empty when the video has not been split into parts. */
    fragments: LibraryFragmentRecord[];
    created_at: string;
    ready_at: string | null;
    /** Presigned playback URL, valid for hours; null while an upload is still open. */
    url: string | null;
}
