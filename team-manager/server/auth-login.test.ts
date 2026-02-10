import { describe, it, expect, beforeEach } from 'vitest';
import { appRouter } from './routers';
import { authService } from './_core/auth';
import type { TrpcContext } from './_core/context';

/**
 * Unit tests for user login endpoint
 * Tests email/password login, credential validation, and token generation
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 3.2, 3.5, 4.1, 4.2, 4.5, 4.6, 7.1, 7.2**
 */

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: 'https',
      headers: {},
    } as TrpcContext['req'],
    res: {} as TrpcContext['res'],
  };
}

describe('auth.login', () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    const ctx = createPublicContext();
    caller = appRouter.createCaller(ctx);
  });

  describe('Successful login', () => {
    it('should login user with correct credentials', async () => {
      // First register a user
      const email = 'login@example.com';
      const password = 'ValidPassword123';

      await caller.auth.register({
        email,
        password,
      });

      // Then login with correct credentials
      const result = await caller.auth.login({
        email,
        password,
      });

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(email);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should return both access and refresh tokens', async () => {
      const email = 'tokens@example.com';
      const password = 'TokenPassword123';

      await caller.auth.register({ email, password });

      const result = await caller.auth.login({ email, password });

      expect(result.accessToken).toBeDefined();
      expect(typeof result.accessToken).toBe('string');
      expect(result.accessToken.length).toBeGreaterThan(0);

      expect(result.refreshToken).toBeDefined();
      expect(typeof result.refreshToken).toBe('string');
      expect(result.refreshToken.length).toBeGreaterThan(0);
    });

    it('should not return passwordHash in response', async () => {
      const email = 'nohash@example.com';
      const password = 'NoHashPassword123';

      await caller.auth.register({ email, password });

      const result = await caller.auth.login({ email, password });

      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should return user data in response', async () => {
      const email = 'userdata@example.com';
      const password = 'UserDataPass123';

      await caller.auth.register({ email, password });

      const result = await caller.auth.login({ email, password });

      expect(result.user.id).toBeDefined();
      expect(typeof result.user.id).toBe('number');
      expect(result.user.email).toBe(email);
      expect(result.user.role).toBe('user');
    });
  });

  describe('Invalid credentials', () => {
    it('should reject login with wrong password', async () => {
      const email = 'wrongpass@example.com';
      const password = 'CorrectPassword123';

      await caller.auth.register({ email, password });

      try {
        await caller.auth.login({
          email,
          password: 'WrongPassword456',
        });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeDefined();
        const message = error instanceof Error ? error.message : String(error);
        expect(message).toContain('Invalid credentials');
      }
    });

    it('should reject login with non-existent email', async () => {
      try {
        await caller.auth.login({
          email: 'nonexistent@example.com',
          password: 'SomePassword123',
        });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeDefined();
        const message = error instanceof Error ? error.message : String(error);
        expect(message).toContain('Invalid credentials');
      }
    });

    it('should use generic error message for security (no email enumeration)', async () => {
      const email = 'enumeration@example.com';
      const password = 'EnumerationPass123';

      await caller.auth.register({ email, password });

      try {
        await caller.auth.login({
          email,
          password: 'WrongPassword',
        });
        expect.fail('Should have thrown error');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // Should not reveal whether email exists
        expect(message).toContain('Invalid credentials');
        expect(message).not.toContain('not found');
        expect(message).not.toContain('does not exist');
      }
    });
  });

  describe('Missing credentials', () => {
    it('should reject login with missing email', async () => {
      try {
        await caller.auth.login({
          email: '',
          password: 'SomePassword123',
        });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeDefined();
        const message = error instanceof Error ? error.message : String(error);
        expect(message).toContain('Email is required');
      }
    });

    it('should reject login with missing password', async () => {
      try {
        await caller.auth.login({
          email: 'user@example.com',
          password: '',
        });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeDefined();
        const message = error instanceof Error ? error.message : String(error);
        expect(message).toContain('Password is required');
      }
    });

    it('should reject login with both email and password missing', async () => {
      try {
        await caller.auth.login({
          email: '',
          password: '',
        });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeDefined();
        const message = error instanceof Error ? error.message : String(error);
        // Should contain validation error
        expect(message).toContain('Validation failed');
      }
    });
  });

  describe('Token generation', () => {
    it('should generate valid access token', async () => {
      const email = 'accesstoken@example.com';
      const password = 'AccessTokenPass123';

      await caller.auth.register({ email, password });

      const result = await caller.auth.login({ email, password });

      // Verify token can be verified
      const payload = await authService.verifyToken(result.accessToken);
      expect(payload).toBeDefined();
      expect(payload?.userId).toBeDefined();
      expect(payload?.email).toBe(email);
      expect(payload?.type).toBe('access');
    });

    it('should generate valid refresh token', async () => {
      const email = 'refreshtoken@example.com';
      const password = 'RefreshTokenPass123';

      await caller.auth.register({ email, password });

      const result = await caller.auth.login({ email, password });

      // Verify token can be verified
      const payload = await authService.verifyToken(result.refreshToken);
      expect(payload).toBeDefined();
      expect(payload?.userId).toBeDefined();
      expect(payload?.email).toBe(email);
      expect(payload?.type).toBe('refresh');
    });

    it('should include userId in token payload', async () => {
      const email = 'userid@example.com';
      const password = 'UserIdPass123';

      const registerResult = await caller.auth.register({ email, password });
      const loginResult = await caller.auth.login({ email, password });

      const payload = await authService.verifyToken(loginResult.accessToken);
      expect(payload?.userId).toBe(String(registerResult.user.id));
    });

    it('should include email in token payload', async () => {
      const email = 'emailpayload@example.com';
      const password = 'EmailPayloadPass123';

      await caller.auth.register({ email, password });
      const loginResult = await caller.auth.login({ email, password });

      const payload = await authService.verifyToken(loginResult.accessToken);
      expect(payload?.email).toBe(email);
    });
  });

  describe('Multiple logins', () => {
    it('should allow multiple logins with same credentials', async () => {
      const email = 'multilogin@example.com';
      const password = 'MultiLoginPass123';

      await caller.auth.register({ email, password });

      // First login
      const result1 = await caller.auth.login({ email, password });
      expect(result1.success).toBe(true);

      // Second login
      const result2 = await caller.auth.login({ email, password });
      expect(result2.success).toBe(true);

      // Both should have valid tokens
      expect(result1.accessToken).toBeDefined();
      expect(result2.accessToken).toBeDefined();
      // Tokens should be different (new tokens generated each time)
      expect(result1.accessToken).not.toBe(result2.accessToken);
    });
  });

  describe('Case sensitivity', () => {
    it('should handle email case sensitivity correctly', async () => {
      const email = 'CaseSensitive@Example.com';
      const password = 'CaseSensitivePass123';

      await caller.auth.register({ email, password });

      // Login with same case
      const result = await caller.auth.login({ email, password });
      expect(result.success).toBe(true);

      // Note: Email case sensitivity depends on database configuration
      // This test documents the current behavior
    });
  });

});
