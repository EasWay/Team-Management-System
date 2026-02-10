# Authentication Restructure Summary

## Overview
Migrated from cookie-based authentication to JWT token-based authentication using Authorization headers.

## Changes Made

### Backend Changes

#### 1. New Auth Service (`server/_core/auth.ts`)
- Created `AuthService` class with JWT token generation and verification
- `generateAccessToken()` - Creates 7-day access tokens
- `generateRefreshToken()` - Creates 30-day refresh tokens
- `verifyToken()` - Validates JWT tokens
- `extractTokenFromHeader()` - Extracts Bearer tokens from Authorization header

#### 2. Updated Context (`server/_core/context.ts`)
- Removed cookie-based authentication
- Now extracts JWT from `Authorization: Bearer <token>` header
- Verifies token and fetches user from database

#### 3. Updated Environment (`server/_core/env.ts`)
- Renamed `cookieSecret` to `jwtSecret`

#### 4. Updated Routers (`server/routers.ts`)
- Removed cookie dependencies
- Added `auth.refreshToken` endpoint for token refresh
- Simplified `auth.logout` (client-side token removal)

#### 5. Updated OAuth Callbacks (`server/oauth-callbacks.ts`)
- Removed cookie setting
- Now returns tokens in URL redirect: `/?accessToken=...&refreshToken=...`
- Updated GitHub and Google OAuth flows
- Updated logout to use Authorization header

#### 6. Updated Socket.io Server (`server/socket-server.ts`)
- Changed `ENV.cookieSecret` to `ENV.jwtSecret`

#### 7. Removed Files
- Can delete `server/_core/cookies.ts` (no longer needed)

### Frontend Changes

#### 1. New Token Storage (`client/src/lib/tokenStorage.ts`)
- Utility for managing tokens in localStorage
- `getAccessToken()` / `setAccessToken()`
- `getRefreshToken()` / `setRefreshToken()`
- `clearTokens()`
- `setTokensFromUrl()` - Extracts tokens from OAuth redirect URL

#### 2. Updated Constants (`shared/const.ts`)
- Removed `COOKIE_NAME`
- Added `TOKEN_STORAGE_KEY` and `REFRESH_TOKEN_STORAGE_KEY`

#### 3. Updated Main Entry (`client/src/main.tsx`)
- Checks for tokens in URL on app load
- Adds `Authorization: Bearer <token>` header to all tRPC requests
- Clears tokens on authentication errors

#### 4. Updated useAuth Hook (`client/src/_core/hooks/useAuth.ts`)
- Clears tokens from localStorage on logout
- Imports and uses `tokenStorage`

#### 5. Updated Socket Context (`client/src/contexts/SocketContext.tsx`)
- Uses `app_access_token` from localStorage for Socket.io authentication

## Authentication Flow

### Login Flow
1. User clicks OAuth login (GitHub/Google)
2. OAuth provider redirects to callback endpoint
3. Backend generates JWT access + refresh tokens
4. Backend redirects to `/?accessToken=...&refreshToken=...`
5. Frontend extracts tokens from URL and stores in localStorage
6. Frontend removes tokens from URL
7. All subsequent requests include `Authorization: Bearer <accessToken>` header

### API Request Flow
1. Frontend reads access token from localStorage
2. Adds `Authorization: Bearer <token>` to request headers
3. Backend extracts token from header
4. Backend verifies JWT and fetches user
5. Request proceeds with authenticated user context

### Logout Flow
1. User clicks logout
2. Frontend calls `auth.logout` mutation
3. Backend optionally clears OAuth tokens from database
4. Frontend clears tokens from localStorage
5. Frontend redirects to login

### Token Refresh Flow
1. Access token expires (7 days)
2. Frontend detects 401 Unauthorized
3. Frontend calls `auth.refreshToken` with refresh token
4. Backend verifies refresh token and generates new access token
5. Frontend stores new access token
6. Frontend retries failed request

## Security Improvements

1. **No CSRF vulnerability** - Tokens in headers aren't sent automatically
2. **Explicit authentication** - Must manually include token in requests
3. **Token expiration** - Access tokens expire in 7 days, refresh in 30 days
4. **Stateless** - Server doesn't need to maintain session state
5. **Mobile-friendly** - Works with mobile apps and APIs

## Migration Notes

### Environment Variables
- Ensure `JWT_SECRET` is set in `.env` file
- Same secret used for both access and refresh tokens

### Database
- No schema changes required
- OAuth tokens table remains unchanged

### Testing
- Update tests to include `Authorization` header
- Mock `tokenStorage` in tests
- Update test context creation

## Next Steps

1. ✅ Implement token refresh logic in frontend
2. ✅ Add token expiration handling
3. ✅ Update all API calls to include Authorization header
4. ⏳ Add token blacklist for logout (optional)
5. ⏳ Implement rate limiting on auth endpoints
6. ⏳ Add token rotation on refresh
7. ⏳ Update all tests to use new auth system

## Breaking Changes

- **Cookies removed** - Old sessions will be invalid
- **All users must re-login** after deployment
- **API clients** must update to send Authorization header
- **Tests** must be updated to use new auth system
