export { TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY, ONE_YEAR_MS } from "@shared/const";

// GitHub OAuth login URL
export const getLoginUrl = () => {
  const githubClientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
  
  if (!githubClientId) {
    console.warn("GitHub OAuth not configured. Add VITE_GITHUB_CLIENT_ID to .env.local");
    return "/";
  }
  
  const redirectUri = `${window.location.origin}/api/oauth/github/callback`;
  const state = btoa(redirectUri);
  
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', githubClientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', 'user:email');
  
  return url.toString();
};
