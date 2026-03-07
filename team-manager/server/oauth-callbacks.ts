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

// Track used OAuth codes to prevent duplicate exchanges
const usedCodes = new Set<string>();

// Clean up old codes after 5 minutes
setInterval(() => {
  usedCodes.clear();
}, 5 * 60 * 1000);

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
    
    if (!user) {
      console.log('[OAuth] Creating new user...');
      // Create new user
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
    } else {
      console.log('[OAuth] Updating existing user:', user.id);
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
    const accessToken = await authService.generateAccessToken(user.id, user.email || '');
    const refreshToken = await authService.generateRefreshToken(user.id, user.email || '');
    console.log('[OAuth] JWT tokens generated');
    
    // Redirect to frontend with tokens in URL (will be stored in localStorage)
    const redirectUrl = `http://localhost:3000/?accessToken=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(refreshToken)}`;
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
      .where(eq(users.openId, googleId))
      .limit(1)
      .then(rows => rows[0]);
    
    if (!user) {
      // Create new user
      const [newUser] = await db
        .insert(users)
        .values({
          openId: googleId,
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
