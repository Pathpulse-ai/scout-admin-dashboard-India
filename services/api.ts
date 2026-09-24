import {
    Submission,
    Stats,
    FraudEvent,
    VerificationStatus,
    Country,
    DetectionTypeCount,
    ScoutAnalytics
} from '@/types';

const API_BASE = '/api';

export const apiService = {
    // Stats
    getStats: async (): Promise<Stats> => {
        const res = await fetch(`${API_BASE}/stats`);
        if (!res.ok) throw new Error('Failed to fetch stats');
        return res.json();
    },

    getDetectionTypes: async (): Promise<DetectionTypeCount[]> => {
        const res = await fetch(`${API_BASE}/detection-types`);
        if (!res.ok) throw new Error('Failed to fetch detection types');
        return res.json();
    },

    getCountries: async (): Promise<Country[]> => {
        const res = await fetch(`${API_BASE}/countries`);
        if (!res.ok) throw new Error('Failed to fetch countries');
        return res.json();
    },

    getScoutAnalytics: async (): Promise<ScoutAnalytics> => {
        const res = await fetch(`${API_BASE}/analytics/scout`);
        if (!res.ok) throw new Error('Failed to fetch scout analytics');
        return res.json();
    },

    // Submissions
    getSubmissions: async (params: {
        limit?: number;
        offset?: number;
        detection_type?: string;
        verification_status?: string;
        country_code?: string;
        media_type?: string;
        date_from?: string;
        date_to?: string;
        account_id?: string;
        username?: string;
    }): Promise<{ submissions: Submission[]; total: number }> => {
        const cleanParams = Object.fromEntries(
            Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
        );
        const query = new URLSearchParams(cleanParams as Record<string, string>).toString();
        const res = await fetch(`${API_BASE}/submissions?${query}`);
        if (!res.ok) throw new Error('Failed to fetch submissions');
        return res.json();
    },

    getSubmissionDetail: async (id: string): Promise<{ submission: Submission; images: Submission['images'] }> => {
        const res = await fetch(`${API_BASE}/submissions/${id}`);
        if (!res.ok) throw new Error('Failed to fetch submission details');
        return res.json();
    },

    updateVerification: async (id: string, status: VerificationStatus, reason?: string): Promise<Submission> => {
        const res = await fetch(`${API_BASE}/submissions/${id}/verify`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, rejection_reason: reason }),
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Failed to update verification');
        }
        return res.json();
    },

    // Fraud
    getFraudEvents: async (limit: number = 50): Promise<FraudEvent[]> => {
        const res = await fetch(`${API_BASE}/fraud?type=events&limit=${limit}`);
        if (!res.ok) throw new Error('Failed to fetch fraud events');
        return res.json();
    },

    getBannedUsers: async (limit: number = 50, offset: number = 0): Promise<{ users: Record<string, unknown>[]; total: number }> => {
        const res = await fetch(`${API_BASE}/fraud?type=banned-users&limit=${limit}&offset=${offset}`);
        if (!res.ok) throw new Error('Failed to fetch banned users');
        return res.json();
    },

    getBannedDevices: async (limit: number = 50, offset: number = 0): Promise<{ bans: Record<string, unknown>[]; total: number }> => {
        const res = await fetch(`${API_BASE}/fraud?type=banned-devices&limit=${limit}&offset=${offset}`);
        if (!res.ok) throw new Error('Failed to fetch banned devices');
        return res.json();
    },

    getHighRiskUsers: async (limit: number = 50, offset: number = 0): Promise<{ users: Record<string, unknown>[]; total: number }> => {
        const res = await fetch(`${API_BASE}/fraud?type=high-risk&limit=${limit}&offset=${offset}`);
        if (!res.ok) throw new Error('Failed to fetch high-risk users');
        return res.json();
    },

    banUser: async (userId: string, reason: string): Promise<{ success: boolean; message: string }> => {
        const res = await fetch(`${API_BASE}/fraud`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'ban-user', targetId: userId, reason }),
        });
        if (!res.ok) throw new Error('Failed to ban user');
        return res.json();
    },

    unbanUser: async (userId: string): Promise<void> => {
        const res = await fetch(`${API_BASE}/admin/admin/unban-user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId }),
        });
        if (!res.ok) throw new Error('Failed to unban user');
    },

    banDevice: async (params: { device_fingerprint: string; reason: string }): Promise<{ success: boolean; message: string }> => {
        const res = await fetch(`${API_BASE}/fraud`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'ban-device', targetId: params.device_fingerprint, reason: params.reason }),
        });
        if (!res.ok) throw new Error('Failed to ban device');
        return res.json();
    },

    // Leaderboard
    getLeaderboard: async (type: string = 'beats', view: string = 'current'): Promise<Record<string, unknown>[]> => {
        const res = await fetch(`${API_BASE}/leaderboard?type=${type}&view=${view}`);
        if (!res.ok) throw new Error('Failed to fetch leaderboard');
        return res.json();
    },
};
