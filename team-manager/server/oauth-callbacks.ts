/**
 * OAuth Callback Handlers
 * 
 * Handles OAuth callbacks for multiple providers (GitHub, Google, Manus)
 * and manages session creation with JWT tokens.
 */

import type { Request, Response } from 'express';
import axios from 'axios';
import { getProvider, type OAuthProviderConfig } from './oauth-providers';
import { storeOAuthToken, deleteAllOAuthTokens } from './oauth-token-service';
import { getDb, upsertUser, getUserByOpenId, automaticallyAssignTeams } from './db';
import { users, teamMembers } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { authService } from './_core/auth';

// Track used OAuth codes to prevent duplicate exchanges
const usedCodes = new Set<string>();
setInterval(() => usedCodes.clear(), 5 * 60 * 1000);

// Pending Google connect flows (state → { userId, mobileRedirect? })
const pendingGoogleConnects = new Map<string, { userId: number; mobileRedirect?: string }>();
setInterval(() => pendingGoogleConnects.clear(), 15 * 60 * 1000);

export function addPendingGoogleConnect(state: string, userId: number, mobileRedirect?: string) {
  pendingGoogleConnects.set(state, { userId, mobileRedirect });
  setTimeout(() => pendingGoogleConnects.delete(state), 10 * 60 * 1000);
}

interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
}

interface GitHubUserInfo {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(
  provider: OAuthProviderConfig,
  code: string
): Promise<OAuthTokenResponse> {
  const params = new URLSearchParams({
    client_id: provider.clientId,
    client_secret: provider.clientSecret,
    code,
    redirect_uri: provider.redirectUri,
    grant_type: 'authorization_code',
  });

  console.log('[OAuth] Exchanging code for token with params:', {
    client_id: provider.clientId,
    redirect_uri: provider.redirectUri,
    code: code.substring(0, 10) + '...',
  });

  const response = await axios.post<OAuthTokenResponse>(
    provider.tokenUrl,
    params.toString(),
    {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  console.log('[OAuth] Token exchange response:', JSON.stringify(response.data, null, 2));

  // GitHub might return the token in different formats
  if (!response.data.access_token) {
    console.error('[OAuth] No access_token in response! Full response:', response.data);
    throw new Error('No access_token in OAuth response');
  }

  return response.data;
}

/**
 * Get user info from GitHub
 */
async function getGitHubUserInfo(accessToken: string): Promise<GitHubUserInfo> {
  console.log('[OAuth] Getting user info with token:', accessToken ? `${accessToken.substring(0, 10)}...` : 'undefined');

  const response = await axios.get<GitHubUserInfo>('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });

  // If email is not public, fetch it from the emails endpoint
  if (!response.data.email) {
    const emailsResponse = await axios.get<Array<{ email: string; primary: boolean; verified: boolean }>>(
      'https://api.github.com/user/emails',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      }
    );

    const primaryEmail = emailsResponse.data.find(e => e.primary && e.verified);
    if (primaryEmail) {
      response.data.email = primaryEmail.email;
    }
  }

  return response.data;
}

/**
 * Get user info from Google
 */
async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await axios.get<GoogleUserInfo>(
    'https://www.googleapis.com/oauth2/v2/userinfo',
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    }
  );

  return response.data;
}

/**
 * GitHub OAuth callback handler
 */
export async function handleGitHubCallback(req: Request, res: Response): Promise<void> {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;

  console.log('[OAuth] GitHub callback received:', { code: code?.substring(0, 10), state });

  if (!code || !state) {
    console.error('[OAuth] Missing code or state');
    res.status(400).json({ error: 'code and state are required' });
    return;
  }

  // Check if this code has already been used
  if (usedCodes.has(code)) {
    console.log('[OAuth] Code already used, ignoring duplicate request');
    res.status(400).json({ error: 'Authorization code already used' });
    return;
  }

  // Mark code as used immediately
  usedCodes.add(code);

  try {
    console.log('[OAuth] Getting GitHub provider config...');
    const provider = getProvider('github');
    if (!provider) {
      console.error('[OAuth] GitHub provider not configured');
      res.status(500).json({ error: 'GitHub OAuth not configured' });
      return;
    }

    console.log('[OAuth] Provider config:', {
      clientId: provider.clientId,
      redirectUri: provider.redirectUri,
    });

    // Exchange code for token
    console.log('[OAuth] Exchanging code for token...');
    const tokenResponse = await exchangeCodeForToken(provider, code);
    console.log('[OAuth] Token exchange successful');

    // Get user info
    console.log('[OAuth] Getting user info...');
    const userInfo = await getGitHubUserInfo(tokenResponse.access_token);
    console.log('[OAuth] User info received:', { id: userInfo.id, login: userInfo.login, email: userInfo.email });

    console.log('[OAuth] Getting database connection...');
    const db = await getDb();
    if (!db) {
      console.error('[OAuth] Database not available');
      res.status(500).json({ error: 'Database not available' });
      return;
    }

    // Find or create user
    const githubId = userInfo.id.toString();
    console.log('[OAuth] Looking for user with openId:', githubId);
    let user = await db
      .select()
      .from(users)
      .where(eq(users.openId, githubId))
      .limit(1)
      .then(rows => rows[0]);

    if (!user && userInfo.email) {
      // Check for a pre-created account with matching email (e.g. seeded members)
      user = await db
        .select()
        .from(users)
        .where(eq(users.email, userInfo.email))
        .limit(1)
        .then(rows => rows[0]);

      if (user) {
        console.log('[OAuth] Linking GitHub ID to existing account by email:', user.id);
        await db
          .update(users)
          .set({
            openId: githubId,
            name: userInfo.name || userInfo.login,
            lastSignedIn: new Date(),
          })
          .where(eq(users.id, user.id));
        user = { ...user, openId: githubId, name: userInfo.name || userInfo.login };
      }
    }

    if (!user) {
      console.log('[OAuth] Creating new user...');
      const [newUser] = await db
        .insert(users)
        .values({
          openId: githubId,
          name: userInfo.name || userInfo.login,
          email: userInfo.email,
          role: 'user',
        })
        .returning();

      user = newUser;
      console.log('[OAuth] New user created:', user.id);
    } else if (user.openId === githubId) {
      console.log('[OAuth] Updating existing user:', user.id);
      await db
        .update(users)
        .set({
          name: userInfo.name || userInfo.login,
          email: userInfo.email,
          lastSignedIn: new Date(),
        })
        .where(eq(users.id, user.id));
    }

    // Ensure user is in teamMembers table (prevents foreign key errors)
    await db.insert(teamMembers).values({
      id: user.id,
      name: user.name || user.email?.split('@')[0] || 'Unknown User',
      email: user.email,
      position: 'Member',
    }).onConflictDoNothing({ target: teamMembers.id });

    // Automatically assign user to all teams
    await automaticallyAssignTeams(user.id);

    // Store OAuth token
    console.log('[OAuth] Storing OAuth token...');
    const expiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : undefined;

    await storeOAuthToken(user.id, 'github', {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt,
    });
    console.log('[OAuth] OAuth token stored');

    // Generate JWT tokens
    console.log('[OAuth] Generating JWT tokens...');
    const accessToken = await authService.generateAccessToken(user.id, user.email || '', user.name || undefined);
    const refreshToken = await authService.generateRefreshToken(user.id, user.email || '', user.name || undefined);
    console.log('[OAuth] JWT tokens generated');

    // Redirect to frontend with tokens in URL (will be stored in localStorage)
    const redirectUrl = `https://team-management-system-zq6x.onrender.com/?accessToken=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(refreshToken)}`;
    console.log('[OAuth] Redirecting to:', redirectUrl);
    res.redirect(302, redirectUrl);
  } catch (error) {
    console.error('[OAuth] GitHub callback failed with error:', error);
    if (error instanceof Error) {
      console.error('[OAuth] Error message:', error.message);
      console.error('[OAuth] Error stack:', error.stack);
    }
    // Remove the code from used codes so it can be retried
    usedCodes.delete(code);
    res.status(500).json({
      error: 'GitHub OAuth callback failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Google OAuth callback handler — handles both connect flows (add Drive to existing account)
 * and standard login flows.
 */
export async function handleGoogleCallback(req: Request, res: Response): Promise<void> {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;

  if (!code || !state) {
    res.status(400).json({ error: 'code and state are required' });
    return;
  }

  // Connect flow: user already logged in, just adding Google for Drive access
  const connectData = pendingGoogleConnects.get(state);
  if (connectData) {
    pendingGoogleConnects.delete(state);
    const mobileRedirect = connectData.mobileRedirect ?? 'team-management://oauth-callback';
    try {
      const provider = getProvider('google');
      if (!provider) throw new Error('Google OAuth not configured');

      const tokenResponse = await exchangeCodeForToken(provider, code);
      const expiresAt = tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000)
        : undefined;

      await storeOAuthToken(connectData.userId, 'google', {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        expiresAt,
      });

      if (connectData.mobileRedirect) {
        return res.redirect(302, `${mobileRedirect}?connected=google`);
      }
      return res.redirect(302, '/?connected=google');
    } catch (error) {
      console.error('[OAuth] Google connect failed', error);
      const msg = error instanceof Error ? encodeURIComponent(error.message) : 'unknown';
      if (connectData.mobileRedirect) return res.redirect(302, `${mobileRedirect}?error=${msg}`);
      return res.status(500).json({ error: 'Google connect failed' });
    }
  }

  // Standard login flow
  try {
    const provider = getProvider('google');
    if (!provider) {
      res.status(500).json({ error: 'Google OAuth not configured' });
      return;
    }

    const tokenResponse = await exchangeCodeForToken(provider, code);
    const userInfo = await getGoogleUserInfo(tokenResponse.access_token);

    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: 'Database not available' });
      return;
    }

    const googleId = userInfo.id;
    let user = await db
      .select()
      .from(users)
      .where(eq(users.openId, googleId))
      .limit(1)
      .then(rows => rows[0]);

    if (!user) {
      const [newUser] = await db
        .insert(users)
        .values({ openId: googleId, name: userInfo.name, email: userInfo.email, role: 'user' })
        .returning();
      user = newUser;
    } else {
      await db
        .update(users)
        .set({ name: userInfo.name, email: userInfo.email, lastSignedIn: new Date() })
        .where(eq(users.id, user.id));
    }

    await db.insert(teamMembers).values({
      id: user.id,
      name: user.name || user.email?.split('@')[0] || 'Unknown User',
      email: user.email,
      position: 'Member',
    }).onConflictDoNothing({ target: teamMembers.id });

    // Automatically assign user to all teams
    await automaticallyAssignTeams(user.id);

    const expiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : undefined;

    await storeOAuthToken(user.id, 'google', {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt,
    });

    const accessToken = await authService.generateAccessToken(user.id, user.email || '', user.name || undefined);
    const refreshToken = await authService.generateRefreshToken(user.id, user.email || '', user.name || undefined);

    const redirectUrl = `/?accessToken=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(refreshToken)}`;
    res.redirect(302, redirectUrl);
  } catch (error) {
    console.error('[OAuth] Google callback failed', error);
    res.status(500).json({ error: 'Google OAuth callback failed' });
  }
}

/**
 * GitHub OAuth callback for mobile apps — redirects to deep link with JWT tokens.
 * The mobile app uses expo-web-browser which captures the redirect_uri callback.
 */
export async function handleGitHubMobileCallback(req: Request, res: Response): Promise<void> {
  const code = req.query.code as string | undefined;

  // Extract the mobile app's redirect URI from state: `${hex}:mobile:${encodedUri}`
  // This allows Expo Go (exp://) and production builds (team-management://) to both work.
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const mobileMarker = ':mobile:';
  const markerIdx = state.indexOf(mobileMarker);
  const rawRedirect = markerIdx !== -1
    ? decodeURIComponent(state.slice(markerIdx + mobileMarker.length))
    : 'team-management://oauth-callback';

  // Guard against open redirect: only allow known schemes
  const safeRedirect = rawRedirect.startsWith('team-management://')
    || rawRedirect.startsWith('exp://')
    ? rawRedirect
    : 'team-management://oauth-callback';

  if (!code) {
    res.redirect(302, `${safeRedirect}?error=missing_code`);
    return;
  }

  if (usedCodes.has(code)) {
    res.redirect(302, `${safeRedirect}?error=code_used`);
    return;
  }

  usedCodes.add(code);

  try {
    const provider = getProvider('github');
    if (!provider) {
      res.redirect(302, `${safeRedirect}?error=not_configured`);
      return;
    }

    // Must use the same redirect_uri sent to GitHub during authorization
    const tokenResponse = await exchangeCodeForToken(provider, code);
    const userInfo = await getGitHubUserInfo(tokenResponse.access_token);

    const db = await getDb();
    if (!db) {
      res.redirect(302, `${safeRedirect}?error=db_unavailable`);
      return;
    }

    const githubId = userInfo.id.toString();
    let user = await db
      .select()
      .from(users)
      .where(eq(users.openId, githubId))
      .limit(1)
      .then((rows: any[]) => rows[0]);

    if (!user) {
      const [newUser] = await db
        .insert(users)
        .values({
          openId: githubId,
          name: userInfo.name || userInfo.login,
          email: userInfo.email,
          role: 'user',
        })
        .returning();
      user = newUser;
    } else {
      await db
        .update(users)
        .set({ name: userInfo.name || userInfo.login, email: userInfo.email, lastSignedIn: new Date() })
        .where(eq(users.id, user.id));
    }

    await db.insert(teamMembers).values({
      id: user.id,
      name: user.name || user.email?.split('@')[0] || 'Unknown User',
      email: user.email,
      position: 'Member',
    }).onConflictDoNothing({ target: teamMembers.id });

    // Automatically assign user to all teams
    await automaticallyAssignTeams(user.id);

    const expiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : undefined;

    await storeOAuthToken(user.id, 'github', {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt,
    });

    const accessToken = await authService.generateAccessToken(user.id, user.email || '', user.name || undefined);
    const refreshToken = await authService.generateRefreshToken(user.id, user.email || '', user.name || undefined);

    // Redirect to the mobile app — expo-web-browser captures this deep link
    const redirectUrl = `${safeRedirect}?accessToken=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(refreshToken)}`;
    res.redirect(302, redirectUrl);
  } catch (error) {
    console.error('[OAuth] Mobile GitHub callback failed:', error);
    usedCodes.delete(code);
    const msg = error instanceof Error ? encodeURIComponent(error.message) : 'unknown';
    res.redirect(302, `${safeRedirect}?error=${msg}`);
  }
}

/**
 * Logout handler - invalidates all OAuth tokens and session
 */
export async function handleLogout(req: Request, res: Response): Promise<void> {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authService.extractTokenFromHeader(authHeader);

    if (token) {
      const payload = await authService.verifyToken(token);

      if (payload) {
        // Delete all OAuth tokens for this user
        await deleteAllOAuthTokens(Number(payload.userId));
      }
    }

    // With token-based auth, logout is handled client-side by removing tokens
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('[OAuth] Logout failed', error);
    res.status(500).json({ error: 'Logout failed' });
  }
}
