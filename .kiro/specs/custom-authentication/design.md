# Design Document: Custom Authentication (Email/Password Login)

## Overview

This design implements a secure email/password authentication system for the Team Manager application. The system integrates with the existing JWT token infrastructure and user management system. It provides registration and login flows with password hashing, token generation, and session management. The implementation uses bcrypt for password security, JWT for stateless authentication, and localStorage for client-side token persistence.

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Client Application                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │  Login Page      │  │ Register Page    │  │ Protected    │  │
│  │  (email/pwd)     │  │ (email/pwd)      │  │ Routes       │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────┬───────┘  │
│           │                     │                    │          │
│           └─────────────────────┼────────────────────┘          │
│                                 │                               │
│                    ┌────────────▼──────────────┐                │
│                    │  Token Storage (localStorage)              │
│                    │  - accessToken            │                │
│                    │  - refreshToken           │                │
│                    └────────────┬──────────────┘                │
│                                 │                               │
│                    ┌────────────▼──────────────┐                │
│                    │  API Request Interceptor  │                │
│                    │  (Add Bearer token)       │                │
│                    └────────────┬──────────────┘                │
└─────────────────────────────────┼──────────────────────────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │   API Server               │
                    ├──────────────────────────┤
                    │  POST /auth/register     │
                    │  POST /auth/login        │
                    │  POST /auth/refresh      │
                    │  POST /auth/logout       │
                    └─────────────┬──────────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │  Authentication Service   │
                    │  - Password hashing       │
                    │  - Token generation       │
                    │  - Token verification     │
                    └─────────────┬──────────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │  Database (SQLite)        │
                    │  - users table            │
                    │  - passwordHash field     │
                    └──────────────────────────┘
```

### Authentication Flow

**Registration Flow:**
1. User submits email and password on registration page
2. Client validates email format and password strength
3. Client sends POST /auth/register with email and password
4. Server validates input (email uniqueness, password requirements)
5. Server hashes password using bcrypt
6. Server creates user record with passwordHash
7. Server generates access and refresh tokens
8. Server returns tokens to client
9. Client stores tokens in localStorage
10. Client redirects to dashboard

**Login Flow:**
1. User submits email and password on login page
2. Client validates input format
3. Client sends POST /auth/login with email and password
4. Server looks up user by email
5. Server compares provided password against stored hash using bcrypt
6. If match: Server generates access and refresh tokens
7. Server updates lastSignedIn timestamp
8. Server returns tokens to client
9. Client stores tokens in localStorage
10. Client redirects to dashboard

**Token Refresh Flow:**
1. Client detects access token expiration (401 response)
2. Client sends POST /auth/refresh with refresh token
3. Server verifies refresh token validity
4. Server generates new access token
5. Server optionally generates new refresh token
6. Server returns new tokens to client
7. Client updates localStorage with new tokens
8. Client retries original request with new access token

**Logout Flow:**
1. User clicks logout button
2. Client removes accessToken from localStorage
3. Client removes refreshToken from localStorage
4. Client clears cached user data
5. Client redirects to login page

## Components and Interfaces

### Server-Side Components

#### AuthService (Enhanced)

Extends existing AuthService with password hashing and verification.

```typescript
interface AuthService {
  // Existing methods
  generateAccessToken(userId: string | number, email: string): Promise<string>
  generateRefreshToken(userId: string | number, email: string): Promise<string>
  verifyToken(token: string): Promise<TokenPayload | null>
  
  // New methods for password-based auth
  hashPassword(password: string): Promise<string>
  verifyPassword(password: string, hash: string): Promise<boolean>
  validatePasswordStrength(password: string): { valid: boolean; errors: string[] }
  validateEmail(email: string): { valid: boolean; error?: string }
}
```

#### Authentication Routes

```typescript
// POST /auth/register
Request: {
  email: string
  password: string
}
Response: {
  success: boolean
  user: {
    id: number
    email: string
    name?: string
    role: string
  }
  accessToken: string
  refreshToken: string
}
Error: {
  error: string
  details?: Record<string, string>
}

// POST /auth/login
Request: {
  email: string
  password: string
}
Response: {
  success: boolean
  user: {
    id: number
    email: string
    name?: string
    role: string
  }
  accessToken: string
  refreshToken: string
}
Error: {
  error: string
}

// POST /auth/refresh
Request: {
  refreshToken: string
}
Response: {
  accessToken: string
  refreshToken?: string
}
Error: {
  error: string
}

// POST /auth/logout
Request: {}
Response: {
  success: boolean
}
```

#### Middleware: Authentication Verification

```typescript
interface AuthMiddleware {
  verifyToken(req: Request, res: Response, next: NextFunction): void
  // Extracts token from Authorization header
  // Verifies token validity
  // Attaches user info to request
  // Returns 401 if invalid/expired
}
```

### Client-Side Components

#### Login Page Component

```typescript
interface LoginPageProps {}

interface LoginFormState {
  email: string
  password: string
  error?: string
  isLoading: boolean
}

// Responsibilities:
// - Display email and password input fields
// - Handle form submission
// - Call POST /auth/login
// - Store tokens in localStorage
// - Redirect to dashboard on success
// - Display error messages on failure
```

#### Registration Page Component

```typescript
interface RegisterPageProps {}

interface RegisterFormState {
  email: string
  password: string
  confirmPassword: string
  errors: Record<string, string>
  isLoading: boolean
}

// Responsibilities:
// - Display email, password, and confirm password fields
// - Validate password strength client-side
// - Display password requirements
// - Call POST /auth/register
// - Store tokens in localStorage
// - Redirect to dashboard on success
// - Display field-level error messages
```

#### Protected Route Component

```typescript
interface ProtectedRouteProps {
  children: React.ReactNode
}

// Responsibilities:
// - Check if access token exists in localStorage
// - Verify token validity
// - Redirect to login if not authenticated
// - Render children if authenticated
// - Handle token refresh on 401 responses
```

#### API Interceptor

```typescript
interface APIInterceptor {
  // Intercepts all API requests
  // Adds Authorization header with access token
  // Handles 401 responses by attempting token refresh
  // Redirects to login if refresh fails
}
```

### Database Schema Updates

#### Users Table Extension

```typescript
// Existing fields:
// id, openId, githubId, googleId, name, email, loginMethod, role, createdAt, updatedAt, lastSignedIn

// New fields:
passwordHash?: string  // bcrypt hash, only for email/password users
```

The passwordHash field is optional because existing OAuth users won't have passwords. The loginMethod field distinguishes between "email", "github", "google", etc.

## Data Models

### User Model (Extended)

```typescript
interface User {
  id: number
  email: string
  name?: string
  role: 'user' | 'admin'
  loginMethod: 'email' | 'github' | 'google'
  passwordHash?: string  // Only for email/password users
  createdAt: Date
  updatedAt: Date
  lastSignedIn: Date
}
```

### Token Payload

```typescript
interface TokenPayload {
  userId: string
  email: string
  type: 'access' | 'refresh'
  iat: number  // Issued at
  exp: number  // Expiration time
}
```

### Authentication Request/Response Models

```typescript
interface RegisterRequest {
  email: string
  password: string
}

interface LoginRequest {
  email: string
  password: string
}

interface AuthResponse {
  success: boolean
  user: {
    id: number
    email: string
    name?: string
    role: string
  }
  accessToken: string
  refreshToken: string
}

interface RefreshRequest {
  refreshToken: string
}

interface RefreshResponse {
  accessToken: string
  refreshToken?: string
}

interface ErrorResponse {
  error: string
  details?: Record<string, string>
}
```

### Validation Models

```typescript
interface PasswordValidationResult {
  valid: boolean
  errors: string[]  // e.g., ["Password must be at least 8 characters"]
}

interface EmailValidationResult {
  valid: boolean
  error?: string
}
```

## Error Handling

### Server-Side Error Handling

**Registration Errors:**
- 400 Bad Request: Invalid email format
- 400 Bad Request: Password too short (< 8 characters)
- 400 Bad Request: Email already exists
- 500 Internal Server Error: Database error during user creation

**Login Errors:**
- 400 Bad Request: Missing email or password
- 401 Unauthorized: Invalid credentials (generic message, no email enumeration)
- 500 Internal Server Error: Database error during lookup

**Token Refresh Errors:**
- 400 Bad Request: Missing refresh token
- 401 Unauthorized: Invalid or expired refresh token
- 500 Internal Server Error: Token generation error

**Protected Route Errors:**
- 401 Unauthorized: Missing access token
- 401 Unauthorized: Invalid access token
- 401 Unauthorized: Expired access token

### Client-Side Error Handling

**Registration Page:**
- Display field-level validation errors below each input
- Show password requirements as user types
- Display server errors in an alert banner
- Preserve email field on error for user convenience

**Login Page:**
- Display generic error message (don't reveal if email exists)
- Preserve email field on error
- Show loading state during submission
- Disable submit button during submission

**Protected Routes:**
- Silently attempt token refresh on 401
- Redirect to login if refresh fails
- Show loading spinner while verifying token
- Preserve user's intended destination for post-login redirect

## Testing Strategy

### Unit Testing

**Password Hashing Tests:**
- Test that passwords are hashed using bcrypt
- Test that the same password produces different hashes (due to salt)
- Test that password verification works correctly
- Test that incorrect passwords fail verification
- Test password validation rules (minimum length, etc.)

**Email Validation Tests:**
- Test valid email formats are accepted
- Test invalid email formats are rejected
- Test edge cases (special characters, unicode, etc.)

**Token Generation Tests:**
- Test that access tokens are generated with correct expiration (7 days)
- Test that refresh tokens are generated with correct expiration (30 days)
- Test that tokens contain correct payload (userId, email, type)
- Test that tokens are signed with HS256

**Token Verification Tests:**
- Test that valid tokens are verified successfully
- Test that expired tokens are rejected
- Test that tampered tokens are rejected
- Test that tokens with wrong signature are rejected

**User Registration Tests:**
- Test successful registration creates user with hashed password
- Test duplicate email registration is rejected
- Test invalid email format is rejected
- Test password too short is rejected
- Test user role is set to "user" by default
- Test loginMethod is set to "email"

**User Login Tests:**
- Test successful login with correct credentials
- Test login fails with wrong password
- Test login fails with non-existent email
- Test lastSignedIn timestamp is updated
- Test tokens are returned on successful login

**Protected Route Tests:**
- Test unauthenticated access is denied
- Test authenticated access is allowed
- Test expired token triggers redirect to login
- Test invalid token triggers redirect to login

### Property-Based Testing

Property-based tests will validate universal correctness properties across many generated inputs.

