/**
 * Development-only authentication bypass
 * Creates a test user for local development without OAuth
 */

import type { Request, Response } from 'express';
import { getDb } from '../db';
import { users } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import { authService } from './auth';

export async function handleDevLogin(req: Request, res: Response): Promise<void> {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    res.status(403).json({ error: 'Dev login only available in development mode' });
    return;
  }

  try {
    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: 'Database not available' });
      return;
    }

    // Create or get test user
    const testEmail = 'dev@test.com';
    let user = await db
      .select()
      .from(users)
      .where(eq(users.email, testEmail))
      .limit(1)
      .then(rows => rows[0]);

    if (!user) {
      // Create test user
      const [newUser] = await db
        .insert(users)
        .values({
          email: testEmail,
          name: 'Dev User',
          role: 'admin',
          loginMethod: 'dev',
        })
        .returning();

      user = newUser;
    }

    // Generate JWT tokens
    const accessToken = await authService.generateAccessToken(user.id, user.email || '');
    const refreshToken = await authService.generateRefreshToken(user.id, user.email || '');

    // Redirect to frontend with tokens
    const redirectUrl = `/?accessToken=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(refreshToken)}`;
    res.redirect(302, redirectUrl);
  } catch (error) {
    console.error('[Dev Auth] Login failed', error);
    res.status(500).json({ error: 'Dev login failed' });
  }
}
