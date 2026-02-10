import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getDb } from './db';
import { users, oauthTokens } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import {
  storeOAuthToken,
  getOAuthToken,
  deleteOAuthToken,
  deleteAllOAuthTokens,
  type TokenData,
} from './oauth-token-service';
import { decrypt } from './crypto';
import type { OAuthProviderName } from './oauth-providers';

/**
 * Feature: collaborative-dev-platform
 * Property 1: OAuth Token Security
 * 
 * Test that all stored tokens are encrypted and properly invalidated on logout
 * **Validates: Requirements 1.3, 1.5, 1.6**
 */

// Generator for OAuth provider names
const providerGenerator = (): fc.Arbitrary<OAuthProviderName> =>
  fc.constantFrom('github', 'google', 'manus');

// Generator for token data
const tokenDataGenerator = (): fc.Arbitrary<TokenData> =>
  fc.record({
    accessToken: fc.string({ minLength: 20, maxLength: 100 }),
    refreshToken: fc.option(fc.string({ minLength: 20, maxLength: 100 })),
    expiresAt: fc.option(fc.date({ min: new Date() })),
  });

describe('OAuth Token Security - Property 1', () => {
  it('should encrypt tokens before storing in database', async () => {
    await fc.assert(
      fc.asyncProperty(
        providerGenerator(),
        tokenDataGenerator(),
        fc.integer({ min: 1, max: 1000000 }), // Unique ID
        async (provider, tokenData, uniqueId) => {
          const db = await getDb();
          if (!db) throw new Error('Database not available');
          
          // Create a test user with unique email
          const uniqueEmail = `test_${Date.now()}_${uniqueId}@example.com`;
          const [user] = await db
            .insert(users)
            .values({
              name: 'Test User',
              email: uniqueEmail,
              role: 'user',
            })
            .returning();
          
          try {
            // Store the token
            await storeOAuthToken(user.id, provider, tokenData);
            
            // Retrieve the raw token from database
            const [storedToken] = await db
              .select()
              .from(oauthTokens)
              .where(eq(oauthTokens.userId, user.id))
              .limit(1);
            
            // Verify token exists
            expect(storedToken).toBeDefined();
            
            // Verify access token is encrypted (not equal to original)
            expect(storedToken.accessToken).not.toBe(tokenData.accessToken);
            
            // Verify encrypted token can be decrypted back to original
            const decryptedAccessToken = decrypt(storedToken.accessToken);
            expect(decryptedAccessToken).toBe(tokenData.accessToken);
            
            // If refresh token exists, verify it's also encrypted
            if (tokenData.refreshToken && storedToken.refreshToken) {
              expect(storedToken.refreshToken).not.toBe(tokenData.refreshToken);
              const decryptedRefreshToken = decrypt(storedToken.refreshToken);
              expect(decryptedRefreshToken).toBe(tokenData.refreshToken);
            }
          } finally {
            // Cleanup
            await db.delete(oauthTokens).where(eq(oauthTokens.userId, user.id));
            await db.delete(users).where(eq(users.id, user.id));
          }
        }
      ),
      { numRuns: 5 }
    );
  });

  it('should properly invalidate tokens on logout', async () => {
    await fc.assert(
      fc.asyncProperty(
        providerGenerator(),
        tokenDataGenerator(),
        fc.integer({ min: 1, max: 1000000 }), // Unique ID
        async (provider, tokenData, uniqueId) => {
          const db = await getDb();
          if (!db) throw new Error('Database not available');
          
          // Create a test user with unique email
          const uniqueEmail = `test_${Date.now()}_${uniqueId}@example.com`;
          const [user] = await db
            .insert(users)
            .values({
              name: 'Test User',
              email: uniqueEmail,
              role: 'user',
            })
            .returning();
          
          try {
            // Store the token
            await storeOAuthToken(user.id, provider, tokenData);
            
            // Verify token exists
            const tokenBefore = await getOAuthToken(user.id, provider);
            expect(tokenBefore).not.toBeNull();
            expect(tokenBefore?.accessToken).toBe(tokenData.accessToken);
            
            // Delete the token (logout)
            await deleteOAuthToken(user.id, provider);
            
            // Verify token is deleted
            const tokenAfter = await getOAuthToken(user.id, provider);
            expect(tokenAfter).toBeNull();
            
            // Verify token is not in database
            const [storedToken] = await db
              .select()
              .from(oauthTokens)
              .where(eq(oauthTokens.userId, user.id))
              .limit(1);
            
            expect(storedToken).toBeUndefined();
          } finally {
            // Cleanup
            await db.delete(oauthTokens).where(eq(oauthTokens.userId, user.id));
            await db.delete(users).where(eq(users.id, user.id));
          }
        }
      ),
      { numRuns: 5 }
    );
  });

  it('should invalidate all tokens on complete logout', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(providerGenerator(), { minLength: 1, maxLength: 3 }),
        fc.array(tokenDataGenerator(), { minLength: 1, maxLength: 3 }),
        fc.integer({ min: 1, max: 1000000 }), // Unique ID
        async (providers, tokenDataArray, uniqueId) => {
          const db = await getDb();
          if (!db) throw new Error('Database not available');
          
          // Create a test user with unique email
          const uniqueEmail = `test_${Date.now()}_${uniqueId}@example.com`;
          const [user] = await db
            .insert(users)
            .values({
              name: 'Test User',
              email: uniqueEmail,
              role: 'user',
            })
            .returning();
          
          try {
            // Store tokens for multiple providers
            const uniqueProviders = [...new Set(providers)];
            for (let i = 0; i < uniqueProviders.length && i < tokenDataArray.length; i++) {
              await storeOAuthToken(user.id, uniqueProviders[i], tokenDataArray[i]);
            }
            
            // Verify tokens exist
            const tokensBefore = await db
              .select()
              .from(oauthTokens)
              .where(eq(oauthTokens.userId, user.id));
            
            expect(tokensBefore.length).toBeGreaterThan(0);
            
            // Delete all tokens (complete logout)
            await deleteAllOAuthTokens(user.id);
            
            // Verify all tokens are deleted
            const tokensAfter = await db
              .select()
              .from(oauthTokens)
              .where(eq(oauthTokens.userId, user.id));
            
            expect(tokensAfter.length).toBe(0);
          } finally {
            // Cleanup
            await db.delete(oauthTokens).where(eq(oauthTokens.userId, user.id));
            await db.delete(users).where(eq(users.id, user.id));
          }
        }
      ),
      { numRuns: 5 }
    );
  });

  it('should retrieve and decrypt tokens correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        providerGenerator(),
        tokenDataGenerator(),
        fc.integer({ min: 1, max: 1000000 }), // Unique ID
        async (provider, tokenData, uniqueId) => {
          const db = await getDb();
          if (!db) throw new Error('Database not available');
          
          // Create a test user with unique email
          const uniqueEmail = `test_${Date.now()}_${uniqueId}@example.com`;
          const [user] = await db
            .insert(users)
            .values({
              name: 'Test User',
              email: uniqueEmail,
              role: 'user',
            })
            .returning();
          
          try {
            // Store the token
            await storeOAuthToken(user.id, provider, tokenData);
            
            // Retrieve the token
            const retrievedToken = await getOAuthToken(user.id, provider);
            
            // Verify token is retrieved correctly
            expect(retrievedToken).not.toBeNull();
            expect(retrievedToken?.accessToken).toBe(tokenData.accessToken);
            
            if (tokenData.refreshToken) {
              expect(retrievedToken?.refreshToken).toBe(tokenData.refreshToken);
            }
            
            if (tokenData.expiresAt) {
              expect(retrievedToken?.expiresAt?.getTime()).toBe(tokenData.expiresAt.getTime());
            }
          } finally {
            // Cleanup
            await db.delete(oauthTokens).where(eq(oauthTokens.userId, user.id));
            await db.delete(users).where(eq(users.id, user.id));
          }
        }
      ),
      { numRuns: 5 }
    );
  });
});
