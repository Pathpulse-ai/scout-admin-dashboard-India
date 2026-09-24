const API_BASE = '/api/admin';

async function fetchAdmin<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                ...options?.headers,
            },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errData = await response.json().catch(() => null) as Record<string, string> | null;
            const errorMessage = errData?.error || errData?.message || response.statusText || 'Admin API Request Failed';

            if (response.status === 500 && (errorMessage.includes('not configured') || errorMessage.includes('SCOUT_BACKEND'))) {
                console.warn(`Admin API Config Warning: ${errorMessage}`);
                throw new Error('CONFIG_ERROR: ' + errorMessage);
            }

            throw new Error(errorMessage);
        }

        return response.json();
    } catch (error: unknown) {
        clearTimeout(timeoutId);
        if (error instanceof Error) {
            if (error.name === 'AbortError') {
                throw new Error('Request timed out after 15 seconds.');
            }
            if (error.message?.startsWith('CONFIG_ERROR')) throw error;
        }
        throw error;
    }
}

interface ResetConfigResponse {
    data: {
        reset_cycle_days: number;
        next_reset_date: string;
        leaderboard_start_date: string;
        cool_down_period_days: number;
        is_in_cool_down_period: boolean;
    };
}

interface WalletBalancesResponse {
    data: {
        address: string;
        balances: Record<string, string>;
    };
}

interface RewardItem {
    id: string | number;
    type: 'beats' | 'referrals';
    identifier: string;
    value: number;
    active: boolean;
    created_at?: string;
    updated_at?: string;
}

interface GlobalRewardsResponse {
    data: RewardItem[];
}

export const adminApi = {
    // Leaderboard Management
    getResetConfig: (): Promise<ResetConfigResponse> =>
        fetchAdmin('/leaderboard/admin/reset-config', { method: 'GET' }),

    updateResetConfig: (data: Record<string, unknown>): Promise<ResetConfigResponse> =>
        fetchAdmin('/leaderboard/admin/reset-config', { method: 'PUT', body: JSON.stringify(data) }),

    triggerReset: (data: { type: string; force?: boolean }): Promise<Record<string, unknown>> =>
        fetchAdmin('/leaderboard/admin/trigger-reset', { method: 'POST', body: JSON.stringify(data) }),

    clearCache: (): Promise<Record<string, unknown>> =>
        fetchAdmin('/leaderboard/admin/clear-cache', { method: 'POST' }),

    rebuildCache: (): Promise<Record<string, unknown>> =>
        fetchAdmin('/leaderboard/admin/rebuild-cache', { method: 'POST' }),

    getGlobalRewards: (): Promise<GlobalRewardsResponse> =>
        fetchAdmin('/leaderboard/admin/global-rewards', { method: 'GET' }),

    updateGlobalRewards: (data: { rewards: RewardItem[] }): Promise<GlobalRewardsResponse> =>
        fetchAdmin('/leaderboard/admin/global-rewards', { method: 'PUT', body: JSON.stringify(data) }),

    getWalletBalances: (): Promise<WalletBalancesResponse> =>
        fetchAdmin('/leaderboard/admin/wallet/balances', { method: 'GET' }),

    // User Management
    banUser: (data: { user_id: string; ban_reason: string }): Promise<Record<string, unknown>> =>
        fetchAdmin('/admin/ban-user', { method: 'POST', body: JSON.stringify(data) }),

    unbanUser: (data: { user_id: string; reason: string }): Promise<Record<string, unknown>> =>
        fetchAdmin('/admin/unban-user', { method: 'POST', body: JSON.stringify(data) }),

    banDevice: (data: { android_id: string; device_info: Record<string, unknown>; reason: string }): Promise<Record<string, unknown>> =>
        fetchAdmin('/admin/ban-device', { method: 'POST', body: JSON.stringify(data) }),

    unbanDevice: (androidId: string): Promise<Record<string, unknown>> =>
        fetchAdmin(`/admin/unban-device/${androidId}`, { method: 'POST' }),
};
