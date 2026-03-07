import { TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY } from '@shared/const';

export const tokenStorage = {
  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  },

  setAccessToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  },

  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  },

  setRefreshToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token);
  },

  clearTokens(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  },

  setTokensFromUrl(): boolean {
    if (typeof window === 'undefined') return false;

    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');

    if (accessToken && refreshToken) {
      this.setAccessToken(accessToken);
      this.setRefreshToken(refreshToken);

      // Clean up URL
      let cleanPath = window.location.pathname;
      if (cleanPath.startsWith('//')) {
        cleanPath = '/' + cleanPath.replace(/^\/+/, '');
      }
      window.history.replaceState({}, document.title, cleanPath || '/');
      return true;
    }

    return false;
  },
};
