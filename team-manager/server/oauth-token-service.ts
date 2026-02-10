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
 * Refresh an OAuth token (placeholder - provider-specific implementation needed)
 */
export async function refreshOAuthToken(
  userId: number,
  provider: OAuthProviderName
): Promise<TokenData | null> {
  const tokenData = await getOAuthToken(userId, provider);
  
  if (!tokenData || !tokenData.refreshToken) {
    return null;
  }
  
  // Provider-specific refresh logic would go here
  // For now, this is a placeholder that returns null
  // Each provider (GitHub, Google) has different refresh token endpoints
  console.warn(`Token refresh not implemented for provider: ${provider}`);
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
