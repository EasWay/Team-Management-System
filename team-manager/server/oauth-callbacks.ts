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
import { getDb, upsertUser, getUserByOpenId } from './db';
import { users } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { authService } from './_core/auth';

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
  
  return response.data;
}

/**
 * Get user info from GitHub
 */
async function getGitHubUserInfo(accessToken: string): Promise<GitHubUserInfo> {
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
  
  if (!code || !state) {
    res.status(400).json({ error: 'code and state are required' });
    return;
  }
  
  try {
    const provider = getProvider('github');
    if (!provider) {
      res.status(500).json({ error: 'GitHub OAuth not configured' });
      return;
    }
    
    // Exchange code for token
    const tokenResponse = await exchangeCodeForToken(provider, code);
    
    // Get user info
    const userInfo = await getGitHubUserInfo(tokenResponse.access_token);
    
    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: 'Database not available' });
      return;
    }
    
    // Find or create user
    const githubId = userInfo.id.toString();
    let user = await db
      .select()
      .from(users)
      .where(eq(users.githubId, githubId))
      .limit(1)
      .then(rows => rows[0]);
    
    if (!user) {
      // Create new user
      const [newUser] = await db
        .insert(users)
        .values({
          githubId,
          name: userInfo.name || userInfo.login,
          email: userInfo.email,
          role: 'user',
        })
        .returning();
      
      user = newUser;
    } else {
      // Update existing user
      await db
        .update(users)
        .set({
          name: userInfo.name || userInfo.login,
          email: userInfo.email,
          lastSignedIn: new Date(),
        })
        .where(eq(users.id, user.id));
    }
    
    // Store OAuth token
    const expiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : undefined;
    
    await storeOAuthToken(user.id, 'github', {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt,
    });
    
    // Generate JWT tokens
    const accessToken = await authService.generateAccessToken(user.id, user.email || '');
    const refreshToken = await authService.generateRefreshToken(user.id, user.email || '');
    
    // Redirect to frontend with tokens in URL (will be stored in localStorage)
    const redirectUrl = `/?accessToken=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(refreshToken)}`;
    res.redirect(302, redirectUrl);
  } catch (error) {
    console.error('[OAuth] GitHub callback failed', error);
    res.status(500).json({ error: 'GitHub OAuth callback failed' });
  }
}

/**
 * Google OAuth callback handler
 */
export async function handleGoogleCallback(req: Request, res: Response): Promise<void> {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;
  
  if (!code || !state) {
    res.status(400).json({ error: 'code and state are required' });
    return;
  }
  
  try {
    const provider = getProvider('google');
    if (!provider) {
      res.status(500).json({ error: 'Google OAuth not configured' });
      return;
    }
    
    // Exchange code for token
    const tokenResponse = await exchangeCodeForToken(provider, code);
    
    // Get user info
    const userInfo = await getGoogleUserInfo(tokenResponse.access_token);
    
    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: 'Database not available' });
      return;
    }
    
    // Find or create user
    const googleId = userInfo.id;
    let user = await db
      .select()
      .from(users)
      .where(eq(users.googleId, googleId))
      .limit(1)
      .then(rows => rows[0]);
    
    if (!user) {
      // Create new user
      const [newUser] = await db
        .insert(users)
        .values({
          googleId,
          name: userInfo.name,
          email: userInfo.email,
          role: 'user',
        })
        .returning();
      
      user = newUser;
    } else {
      // Update existing user
      await db
        .update(users)
        .set({
          name: userInfo.name,
          email: userInfo.email,
          lastSignedIn: new Date(),
        })
        .where(eq(users.id, user.id));
    }
    
    // Store OAuth token
    const expiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : undefined;
    
    await storeOAuthToken(user.id, 'google', {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt,
    });
    
    // Generate JWT tokens
    const accessToken = await authService.generateAccessToken(user.id, user.email || '');
    const refreshToken = await authService.generateRefreshToken(user.id, user.email || '');
    
    // Redirect to frontend with tokens in URL (will be stored in localStorage)
    const redirectUrl = `/?accessToken=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(refreshToken)}`;
    res.redirect(302, redirectUrl);
  } catch (error) {
    console.error('[OAuth] Google callback failed', error);
    res.status(500).json({ error: 'Google OAuth callback failed' });
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
