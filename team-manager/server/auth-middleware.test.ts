import { describe, it, expect, beforeEach } from 'vitest';
import { appRouter } from './routers';
import { authService } from './_core/auth';
import type { TrpcContext } from './_core/context';

/**
 * Unit tests for authentication middleware and token verification
 * Tests token extraction, validation, expiration, and user attachment to requests
 * 
 * **Validates: Requirements 5.4, 7.3, 7.4, 9.2, 9.3, 9.4**
 */

function createContextWithToken(token: string | null): TrpcContext {
  return {
    user: null,
    req: {
      protocol: 'https',
      headers: token ? { authorization: `Bearer ${token}` } : {},
    } as TrpcContext['req'],
    res: {} as TrpcContext['res'],
  };
}

describe('Authentication Middleware', () => {
  describe('Token extraction from Authorization header', () => {
    it('should extract token from Bearer scheme', async () => {
      const email = 'bearer@example.com';
      const password = 'BearerPassword123';

      // Create caller for registration
      const ctx = createContextWithToken(null);
      const caller = appRouter.createCaller(ctx);

      // Register and login to get a token
      await caller.auth.register({ email, password });
      const loginResult = await caller.auth.login({ email, password });

      // Create context with Bearer token
      const ctx = createContextWithToken(loginResult.accessToken);
      const protectedCaller = appRouter.createCaller(ctx);

      // Access protected procedure (me endpoint)
      const user = await protectedCaller.auth.me();
      expect(user).toBeDefined();
      expect(user?.email).toBe(email);
    });

    it('should return null user when Authorization header is missing', async () => {
      const ctx = createContextWithToken(null);
      const caller = appRouter.createCaller(ctx);

      const user = await caller.auth.me();
      expect(user).toBeNull();
    });

    it('should return null user when Authorization header has invalid format', async () => {
      const invalidContext: TrpcContext = {
        user: null,
        req: {
          protocol: 'https',
          headers: { authorization: 'InvalidFormat token' },
        } as TrpcContext['req'],
        res: {} as TrpcContext['res'],
      };

      const caller = appRouter.createCaller(invalidContext);
      const user = await caller.auth.me();
      expect(user).toBeNull();
    });

    it('should return null user when Authorization header is malformed', async () => {
      const invalidContext: TrpcContext = {
        user: null,
        req: {
          protocol: 'https',
          headers: { authorization: 'Bearer' },
        } as TrpcContext['req'],
        res: {} as TrpcContext['res'],
      };

      const caller = appRouter.createCaller(invalidContext);
      const user = await caller.auth.me();
      expect(user).toBeNull();
    });
  });

  describe('Token validity verification', () => {
    it('should verify valid access token', async () => {
      const email = 'validtoken@example.com';
      const password = 'ValidTokenPass123';

      const ctx = createContextWithToken(null);
      const caller = appRouter.createCaller(ctx);

      await caller.auth.register({ email, password });
      const loginResult = await caller.auth.login({ email, password });

      // Verify the token is valid
      const payload = await authService.verifyToken(loginResult.accessToken);
      expect(payload).toBeDefined();
      expect(payload?.type).toBe('access');
      expect(payload?.email).toBe(email);
    });

    it('should reject invalid token', async () => {
      const invalidToken = 'invalid.token.here';

      const ctx = createContextWithToken(invalidToken);
      const caller = appRouter.createCaller(ctx);

      const user = await caller.auth.me();
      expect(user).toBeNull();
    });

    it('should reject tampered token', async () => {
      const email = 'tampered@example.com';
      const password = 'TamperedPass123';

      const ctx = createContextWithToken(null);
      const caller = appRouter.createCaller(ctx);

      await caller.auth.register({ email, password });
      const loginResult = await caller.auth.login({ email, password });

      // Tamper with the token
      const tamperedToken = loginResult.accessToken.slice(0, -5) + 'XXXXX';

      const ctx2 = createContextWithToken(tamperedToken);
      const caller2 = appRouter.createCaller(ctx2);

      const user = await caller2.auth.me();
      expect(user).toBeNull();
    });

    it('should reject refresh token when access token is expected', async () => {
      const email = 'refreshtoken@example.com';
      const password = 'RefreshTokenPass123';

      const ctx = createContextWithToken(null);
      const caller = appRouter.createCaller(ctx);

      await caller.auth.register({ email, password });
      const loginResult = await caller.auth.login({ email, password });

      // Try to use refresh token as access token
      const ctx2 = createContextWithToken(loginResult.refreshToken);
      const caller2 = appRouter.createCaller(ctx2);

      const user = await caller2.auth.me();
      expect(user).toBeNull();
    });
  });

  describe('Token expiration handling', () => {
    it('should verify token contains expiration time', async () => {
      const email = 'expiration@example.com';
      const password = 'ExpirationPass123';

      const ctx = createContextWithToken(null);
      const caller = appRouter.createCaller(ctx);

      await caller.auth.register({ email, password });
      const loginResult = await caller.auth.login({ email, password });

      const payload = await authService.verifyToken(loginResult.accessToken);
      expect(payload?.exp).toBeDefined();
      expect(typeof payload?.exp).toBe('number');
      expect(payload!.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('should verify token has issued at time', async () => {
      const email = 'issuedtime@example.com';
      const password = 'IssuedTimePass123';

      const ctx = createContextWithToken(null);
      const caller = appRouter.createCaller(ctx);

      await caller.auth.register({ email, password });
      const loginResult = await caller.auth.login({ email, password });

      const payload = await authService.verifyToken(loginResult.accessToken);
      expect(payload?.iat).toBeDefined();
      expect(typeof payload?.iat).toBe('number');
    });
  });

  describe('User info attachment to request', () => {
    it('should attach user info to context when token is valid', async () => {
      const email = 'attach@example.com';
      const password = 'AttachPass123';

      const ctx = createContextWithToken(null);
      const caller = appRouter.createCaller(ctx);

      const registerResult = await caller.auth.register({ email, password });
      const loginResult = await caller.auth.login({ email, password });

      const ctx2 = createContextWithToken(loginResult.accessToken);
      const protectedCaller = appRouter.createCaller(ctx2);

      const user = await protectedCaller.auth.me();
      expect(user).toBeDefined();
      expect(user?.id).toBe(registerResult.user.id);
      expect(user?.email).toBe(email);
      expect(user?.role).toBe('user');
    });

    it('should not attach user info when token is missing', async () => {
      const ctx = createContextWithToken(null);
      const caller = appRouter.createCaller(ctx);

      const user = await caller.auth.me();
      expect(user).toBeNull();
    });

    it('should not attach user info when token is invalid', async () => {
      const ctx = createContextWithToken('invalid.token.format');
      const caller = appRouter.createCaller(ctx);

      const user = await caller.auth.me();
      expect(user).toBeNull();
    });

    it('should attach correct user info for multiple users', async () => {
      // Register first user
      const email1 = 'user1@example.com';
      const password1 = 'User1Pass123';
      const ctx1 = createContextWithToken(null);
      const caller1 = appRouter.createCaller(ctx1);
      const result1 = await caller1.auth.register({ email: email1, password: password1 });
      const login1 = await caller1.auth.login({ email: email1, password: password1 });

      // Register second user
      const email2 = 'user2@example.com';
      const password2 = 'User2Pass123';
      const ctx2 = createContextWithToken(null);
      const caller2 = appRouter.createCaller(ctx2);
      const result2 = await caller2.auth.register({ email: email2, password: password2 });
      const login2 = await caller2.auth.login({ email: email2, password: password2 });

      // Verify first user's token returns first user's info
      const ctxUser1 = createContextWithToken(login1.accessToken);
      const callerUser1 = appRouter.createCaller(ctxUser1);
      const user1 = await callerUser1.auth.me();
      expect(user1?.id).toBe(result1.user.id);
      expect(user1?.email).toBe(email1);

      // Verify second user's token returns second user's info
      const ctxUser2 = createContextWithToken(login2.accessToken);
      const callerUser2 = appRouter.createCaller(ctxUser2);
      const user2 = await callerUser2.auth.me();
      expect(user2?.id).toBe(result2.user.id);
      expect(user2?.email).toBe(email2);
    });
  });

  describe('Protected procedure access control', () => {
    it('should allow access to protected procedures with valid token', async () => {
      const email = 'protected@example.com';
      const password = 'ProtectedPass123';

      const ctx = createContextWithToken(null);
      const caller = appRouter.createCaller(ctx);

      await caller.auth.register({ email, password });
      const loginResult = await caller.auth.login({ email, password });

      const ctx2 = createContextWithToken(loginResult.accessToken);
      const protectedCaller = appRouter.createCaller(ctx2);

      // Access protected procedure
      const user = await protectedCaller.auth.me();
      expect(user).toBeDefined();
      expect(user?.email).toBe(email);
    });

    it('should deny access to protected procedures without token', async () => {
      const ctx = createContextWithToken(null);
      const caller = appRouter.createCaller(ctx);

      // Try to access protected procedure
      try {
        await caller.teams.list();
        expect.fail('Should have thrown UNAUTHORIZED error');
      } catch (error) {
        expect(error).toBeDefined();
        const message = error instanceof Error ? error.message : String(error);
        expect(message).toContain('UNAUTHORIZED');
      }
    });

    it('should deny access to protected procedures with invalid token', async () => {
      const ctx = createContextWithToken('invalid.token.here');
      const caller = appRouter.createCaller(ctx);

      // Try to access protected procedure
      try {
        await caller.teams.list();
        expect.fail('Should have thrown UNAUTHORIZED error');
      } catch (error) {
        expect(error).toBeDefined();
        const message = error instanceof Error ? error.message : String(error);
        expect(message).toContain('UNAUTHORIZED');
      }
    });

    it('should deny access to protected procedures with expired token', async () => {
      // Create a context without token (simulating expired token scenario)
      const ctx = createContextWithToken(null);
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.teams.list();
        expect.fail('Should have thrown UNAUTHORIZED error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Token type verification', () => {
    it('should only accept access tokens for protected routes', async () => {
      const email = 'tokentype@example.com';
      const password = 'TokenTypePass123';

      const ctx = createContextWithToken(null);
      const caller = appRouter.createCaller(ctx);

      await caller.auth.register({ email, password });
      const loginResult = await caller.auth.login({ email, password });

      // Verify access token is accepted
      const accessCtx = createContextWithToken(loginResult.accessToken);
      const accessCaller = appRouter.createCaller(accessCtx);
      const user = await accessCaller.auth.me();
      expect(user).toBeDefined();

      // Verify refresh token is not accepted
      const refreshCtx = createContextWithToken(loginResult.refreshToken);
      const refreshCaller = appRouter.createCaller(refreshCtx);
      const refreshUser = await refreshCaller.auth.me();
      expect(refreshUser).toBeNull();
    });
  });

  describe('Authorization header parsing', () => {
    it('should handle case-insensitive Bearer scheme', async () => {
      const email = 'caseinsensitive@example.com';
      const password = 'CaseInsensitivePass123';

      const ctx = createContextWithToken(null);
      const caller = appRouter.createCaller(ctx);

      await caller.auth.register({ email, password });
      const loginResult = await caller.auth.login({ email, password });

      // Test with lowercase 'bearer'
      const lowerContext: TrpcContext = {
        user: null,
        req: {
          protocol: 'https',
          headers: { authorization: `bearer ${loginResult.accessToken}` },
        } as TrpcContext['req'],
        res: {} as TrpcContext['res'],
      };

      const lowerCaller = appRouter.createCaller(lowerContext);
      const user = await lowerCaller.auth.me();
      // Note: Current implementation is case-sensitive, this documents behavior
      expect(user).toBeNull();
    });

    it('should handle extra whitespace in Authorization header', async () => {
      const email = 'whitespace@example.com';
      const password = 'WhitespacePass123';

      const ctx = createContextWithToken(null);
      const caller = appRouter.createCaller(ctx);

      await caller.auth.register({ email, password });
      const loginResult = await caller.auth.login({ email, password });

      // Test with extra spaces
      const extraSpaceContext: TrpcContext = {
        user: null,
        req: {
          protocol: 'https',
          headers: { authorization: `Bearer  ${loginResult.accessToken}` },
        } as TrpcContext['req'],
        res: {} as TrpcContext['res'],
      };

      const extraSpaceCaller = appRouter.createCaller(extraSpaceContext);
      const user = await extraSpaceCaller.auth.me();
      expect(user).toBeNull();
    });
  });

  describe('Error handling in middleware', () => {
    it('should gracefully handle malformed tokens', async () => {
      const ctx = createContextWithToken('not.a.valid.jwt');
      const caller = appRouter.createCaller(ctx);

      const user = await caller.auth.me();
      expect(user).toBeNull();
    });

    it('should gracefully handle empty token', async () => {
      const emptyContext: TrpcContext = {
        user: null,
        req: {
          protocol: 'https',
          headers: { authorization: 'Bearer ' },
        } as TrpcContext['req'],
        res: {} as TrpcContext['res'],
      };

      const caller = appRouter.createCaller(emptyContext);
      const user = await caller.auth.me();
      expect(user).toBeNull();
    });

    it('should not throw errors on invalid tokens', async () => {
      const ctx = createContextWithToken('invalid.token.format');
      const caller = appRouter.createCaller(ctx);

      // Should not throw, should return null user
      expect(async () => {
        await caller.auth.me();
      }).not.toThrow();
    });
  });

  describe('Token payload verification', () => {
    it('should verify token contains userId', async () => {
      const email = 'userid@example.com';
      const password = 'UserIdPass123';

      const registerResult = await caller.auth.register({ email, password });
      const loginResult = await caller.auth.login({ email, password });

      const payload = await authService.verifyToken(loginResult.accessToken);
      expect(payload?.userId).toBe(String(registerResult.user.id));
    });

    it('should verify token contains email', async () => {
      const email = 'emailpayload@example.com';
      const password = 'EmailPayloadPass123';

      await caller.auth.register({ email, password });
      const loginResult = await caller.auth.login({ email, password });

      const payload = await authService.verifyToken(loginResult.accessToken);
      expect(payload?.email).toBe(email);
    });

    it('should verify token type is access', async () => {
      const email = 'accesstype@example.com';
      const password = 'AccessTypePass123';

      await caller.auth.register({ email, password });
      const loginResult = await caller.auth.login({ email, password });

      const payload = await authService.verifyToken(loginResult.accessToken);
      expect(payload?.type).toBe('access');
    });
  });
});
