import { create } from 'zustand';
import { SecureStorage } from '@/lib/secureStorage';
import { STORAGE_KEYS } from '@/lib/constants';

export interface MobileUser {
  id: number;
  email: string;
  name: string;
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
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
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

      if (token && userJson) {
        const user = JSON.parse(userJson) as MobileUser;
        set({ user, accessToken: token, refreshToken: refresh, isAuthenticated: true });
      }
    } catch {
      // Storage error, stay logged out
    } finally {
      set({ isLoading: false });
    }
  },
}));
