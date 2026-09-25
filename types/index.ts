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
}

export interface Stats {
    total_submissions: number;
    verified: number;
    rejected: number;
    pending: number;
    total_frames: number;
    total_videos?: number;
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
