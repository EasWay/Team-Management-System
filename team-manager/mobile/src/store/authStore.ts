import { create } from 'zustand';
import { SecureStorage } from '@/lib/secureStorage';
import { STORAGE_KEYS, API_BASE_URL } from '@/lib/constants';

export interface MobileUser {
  id: number;
  email: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  role?: string;
}

interface AuthState {
  user: MobileUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setAuth: (user: MobileUser, accessToken: string, refreshToken: string) => Promise<void>;
  updateUser: (updates: Partial<Pick<MobileUser, 'name' | 'username' | 'avatarUrl'>>) => Promise<void>;
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

async function validateAndRefreshToken(
  token: string,
  refresh: string | null,
  user: MobileUser,
  set: (partial: Partial<AuthState>) => void
): Promise<void> {
  const meResp = await fetch(`${API_BASE_URL}/api/trpc/auth.me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (meResp.ok) return; // Token still valid, nothing to do

  // 401 → access token expired, try refresh token
  if (meResp.status === 401 && refresh) {
    const refreshResp = await fetch(`${API_BASE_URL}/api/trpc/auth.refreshToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json: { refreshToken: refresh } }),
    });

    if (refreshResp.ok) {
      const json = await refreshResp.json();
      const data = json?.result?.data?.json ?? json?.result?.data;
      if (data?.accessToken) {
        await SecureStorage.set(STORAGE_KEYS.ACCESS_TOKEN, data.accessToken);
        if (data.refreshToken) {
          await SecureStorage.set(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
        }
        set({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken ?? refresh,
        });
        return;
      }
    }

    // Refresh also failed → both tokens dead, log out
    await SecureStorage.clearAuth();
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: true,
  isAuthenticated: false,

  setAuth: async (user, accessToken, refreshToken) => {
    await SecureStorage.set(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    await SecureStorage.set(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    await SecureStorage.set(STORAGE_KEYS.USER, JSON.stringify(user));
    set({ user, accessToken, refreshToken, isAuthenticated: true, isLoading: false });
  },

  updateUser: async (updates) => {
    set((state) => {
      if (!state.user) return state;
      const updated = { ...state.user, ...updates };
      SecureStorage.set(STORAGE_KEYS.USER, JSON.stringify(updated)).catch(() => {});
      return { user: updated };
    });
  },

  logout: async () => {
    await SecureStorage.clearAuth();
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, isLoading: false });
  },

  loadFromStorage: async () => {
    try {
      const [token, refresh, userJson] = await Promise.all([
        SecureStorage.get(STORAGE_KEYS.ACCESS_TOKEN),
        SecureStorage.get(STORAGE_KEYS.REFRESH_TOKEN),
        SecureStorage.get(STORAGE_KEYS.USER),
      ]);

      if (!token || !userJson) return;

      // Restore auth immediately so the app opens without showing login
      const user = JSON.parse(userJson) as MobileUser;
      set({ user, accessToken: token, refreshToken: refresh, isAuthenticated: true });

      // Background: silently refresh if token is expired (non-blocking)
      validateAndRefreshToken(token, refresh, user, set).catch(() => {});
    } catch {
      // Storage / network error — stay logged out
    } finally {
      set({ isLoading: false });
    }
  },
}));
