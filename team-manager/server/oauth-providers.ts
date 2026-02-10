/**
 * OAuth Provider Configurations
 * 
 * This module defines the configuration for multiple OAuth providers
 * (GitHub, Google, Manus) and provides a unified interface for OAuth flows.
 */

export type OAuthProviderName = 'github' | 'google' | 'manus';

export interface OAuthProviderConfig {
  name: OAuthProviderName;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
}

/**
 * Get OAuth provider configuration from environment variables
 */
function getProviderConfig(provider: OAuthProviderName): OAuthProviderConfig | null {
  const baseUrl = process.env.OAUTH_SERVER_URL || 'http://localhost:3000';
  
  switch (provider) {
    case 'github':
      const githubClientId = process.env.GITHUB_CLIENT_ID;
      const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;
      
      if (!githubClientId || !githubClientSecret) {
        console.warn('GitHub OAuth not configured: GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET required');
        return null;
      }
      
      return {
        name: 'github',
        clientId: githubClientId,
        clientSecret: githubClientSecret,
        redirectUri: `${baseUrl}/api/oauth/github/callback`,
        authorizationUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        userInfoUrl: 'https://api.github.com/user',
        scopes: ['user:email', 'read:user', 'repo'],
      };
      
    case 'google':
      const googleClientId = process.env.GOOGLE_CLIENT_ID;
      const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
      
      if (!googleClientId || !googleClientSecret) {
        console.warn('Google OAuth not configured: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET required');
        return null;
      }
      
      return {
        name: 'google',
        clientId: googleClientId,
        clientSecret: googleClientSecret,
        redirectUri: `${baseUrl}/api/oauth/google/callback`,
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        scopes: ['openid', 'email', 'profile'],
      };
      
    case 'manus':
      // Manus OAuth uses the existing SDK configuration
      return {
        name: 'manus',
        clientId: process.env.VITE_APP_ID || 'team-manager-dev',
        clientSecret: process.env.JWT_SECRET || 'development-secret-key',
        redirectUri: `${baseUrl}/api/oauth/callback`,
        authorizationUrl: `${process.env.VITE_OAUTH_PORTAL_URL || baseUrl}/oauth/authorize`,
        tokenUrl: `${baseUrl}/api/oauth/token`,
        userInfoUrl: `${baseUrl}/api/oauth/userinfo`,
        scopes: ['openid', 'profile', 'email'],
      };
      
    default:
      return null;
  }
}

/**
 * Get all configured OAuth providers
 */
export function getConfiguredProviders(): OAuthProviderConfig[] {
  const providers: OAuthProviderConfig[] = [];
  
  const github = getProviderConfig('github');
  if (github) providers.push(github);
  
  const google = getProviderConfig('google');
  if (google) providers.push(google);
  
  const manus = getProviderConfig('manus');
  if (manus) providers.push(manus);
  
  return providers;
}

/**
 * Get a specific OAuth provider configuration
 */
export function getProvider(name: OAuthProviderName): OAuthProviderConfig | null {
  return getProviderConfig(name);
}

/**
 * Check if a provider is configured
 */
export function isProviderConfigured(name: OAuthProviderName): boolean {
  return getProviderConfig(name) !== null;
}

/**
 * Generate OAuth authorization URL
 */
export function generateAuthorizationUrl(provider: OAuthProviderConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: provider.clientId,
    redirect_uri: provider.redirectUri,
    scope: provider.scopes.join(' '),
    state,
    response_type: 'code',
  });
  
  // Google requires access_type=offline for refresh tokens
  if (provider.name === 'google') {
    params.append('access_type', 'offline');
    params.append('prompt', 'consent');
  }
  
  return `${provider.authorizationUrl}?${params.toString()}`;
}
