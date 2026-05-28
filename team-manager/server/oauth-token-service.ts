/**
 * OAuth Token Service
 * 
 * Handles secure storage, retrieval, and management of OAuth tokens
 * with encryption/decryption using the crypto utilities.
 */

import { eq, and } from 'drizzle-orm';
import { getDb } from './db';
import { oauthTokens, type OAuthToken, type InsertOAuthToken } from '../drizzle/schema';
import { encrypt, decrypt } from './crypto';
import type { OAuthProviderName } from './oauth-providers';

export interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

/**
 * Store OAuth tokens for a user with encryption
 */
export async function storeOAuthToken(
  userId: number,
  provider: OAuthProviderName,
  tokenData: TokenData
): Promise<OAuthToken> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }
  
  // Encrypt tokens before storage
  const encryptedAccessToken = encrypt(tokenData.accessToken);
  const encryptedRefreshToken = tokenData.refreshToken ? encrypt(tokenData.refreshToken) : null;
  
  // Check if token already exists for this user and provider
  const existing = await db
    .select()
    .from(oauthTokens)
    .where(and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, provider)))
    .limit(1);
  
  if (existing.length > 0) {
    // Update existing token
    const updated = await db
      .update(oauthTokens)
      .set({
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: tokenData.expiresAt || null,
        updatedAt: new Date(),
      })
      .where(eq(oauthTokens.id, existing[0].id))
      .returning();
    
    return updated[0];
  } else {
    // Insert new token
    const inserted = await db
      .insert(oauthTokens)
      .values({
        userId,
        provider,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: tokenData.expiresAt || null,
      })
      .returning();
    
    return inserted[0];
  }
}

/**
 * Retrieve and decrypt OAuth tokens for a user and provider
 */
export async function getOAuthToken(
  userId: number,
  provider: OAuthProviderName
): Promise<TokenData | null> {
  const db = await getDb();
  if (!db) {
    return null;
  }
  
  const tokens = await db
    .select()
    .from(oauthTokens)
    .where(and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, provider)))
    .limit(1);
  
  if (tokens.length === 0) {
    return null;
  }
  
  const token = tokens[0];
  
  try {
    // Decrypt tokens
    const accessToken = decrypt(token.accessToken);
    const refreshToken = token.refreshToken ? decrypt(token.refreshToken) : undefined;
    
    return {
      accessToken,
      refreshToken,
      expiresAt: token.expiresAt || undefined,
    };
  } catch (error) {
    console.error(`Failed to decrypt OAuth token for user ${userId}, provider ${provider}:`, error);
    return null;
  }
}

/**
 * Check if a token is expired
 */
export function isTokenExpired(expiresAt?: Date): boolean {
  if (!expiresAt) {
    return false; // No expiration date means token doesn't expire
  }
  
  return new Date() >= expiresAt;
}

/**
 * Refresh a Google access token using the stored refresh token
 */
async function refreshGoogleToken(userId: number, tokenData: TokenData): Promise<TokenData | null> {
  if (!tokenData.refreshToken) return null;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokenData.refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });

    if (!resp.ok) return null;

    const data = await resp.json() as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;

    const expiresAt = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : undefined;

    const refreshed: TokenData = {
      accessToken: data.access_token,
      refreshToken: tokenData.refreshToken,
      expiresAt,
    };

    await storeOAuthToken(userId, 'google', refreshed);
    return refreshed;
  } catch {
    return null;
  }
}

/**
 * Get a valid (non-expired) OAuth token, refreshing automatically if needed.
 * Use this instead of getOAuthToken whenever the token will be used for an API call.
 */
export async function getValidOAuthToken(
  userId: number,
  provider: OAuthProviderName
): Promise<TokenData | null> {
  const tokenData = await getOAuthToken(userId, provider);
  if (!tokenData) return null;

  // Refresh if expired or expiring within the next 5 minutes
  const soonExpired = tokenData.expiresAt
    ? new Date() >= new Date(tokenData.expiresAt.getTime() - 5 * 60 * 1000)
    : false;

  if (soonExpired && provider === 'google') {
    const refreshed = await refreshGoogleToken(userId, tokenData);
    if (refreshed) return refreshed;
  }

  return tokenData;
}

/**
 * Refresh an OAuth token
 */
export async function refreshOAuthToken(
  userId: number,
  provider: OAuthProviderName
): Promise<TokenData | null> {
  const tokenData = await getOAuthToken(userId, provider);
  if (!tokenData) return null;
  if (provider === 'google') return refreshGoogleToken(userId, tokenData);
  return null;
}

/**
 * Delete OAuth tokens for a user and provider (used during logout)
 */
export async function deleteOAuthToken(
  userId: number,
  provider: OAuthProviderName
): Promise<void> {
  const db = await getDb();
  if (!db) {
    return;
  }
  
  await db
    .delete(oauthTokens)
    .where(and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, provider)));
}

/**
 * Delete all OAuth tokens for a user (used during complete logout)
 */
export async function deleteAllOAuthTokens(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    return;
  }
  
  await db
    .delete(oauthTokens)
    .where(eq(oauthTokens.userId, userId));
}

/**
 * Get all providers that have tokens for a user
 */
export async function getUserProviders(userId: number): Promise<OAuthProviderName[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }
  
  const tokens = await db
    .select({ provider: oauthTokens.provider })
    .from(oauthTokens)
    .where(eq(oauthTokens.userId, userId));
  
  return tokens.map(t => t.provider as OAuthProviderName);
}
