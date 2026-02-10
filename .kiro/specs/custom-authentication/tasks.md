# Implementation Plan: Custom Authentication (Email/Password Login)

## Overview

This implementation plan breaks down the custom email/password authentication system into discrete, actionable coding tasks. The system integrates with existing JWT infrastructure and user management, providing secure registration, login, token management, and session handling. Tasks are organized by component with clear dependencies and acceptance criteria tied to specific requirements.

## Tasks

- [ ] 1. Update database schema for password authentication
  - Add `passwordHash` field to users table (nullable string)
  - Create and run database migration
  - Verify email field is unique and indexed
  - _Requirements: 10.1, 10.2, 10.4_

- [ ] 2. Implement password hashing and validation utilities
  - [ ] 2.1 Add bcrypt password hashing to AuthService
    - Implement `hashPassword(password: string): Promise<string>` using bcrypt with salt factor ≥ 10
    - Implement `verifyPassword(password: string, hash: string): Promise<boolean>` for verification
    - _Requirements: 3.1, 3.2_
  
  - [ ]* 2.2 Write property test for password hashing
    - **Property 1: Password hashing produces different hashes for same input (due to salt)**
    - **Validates: Requirements 3.1**
  
  - [ ] 2.3 Add password strength validation to AuthService
    - Implement `validatePasswordStrength(password: string): { valid: boolean; errors: string[] }`
    - Enforce minimum 8 character requirement
    - _Requirements: 1.4, 7.6_
  
  - [ ] 2.4 Add email format validation to AuthService
    - Implement `validateEmail(email: string): { valid: boolean; error?: string }`
    - Validate RFC 5322 email format
    - _Requirements: 1.3, 7.2_

- [ ] 3. Implement user registration endpoint
  - [ ] 3.1 Create POST /api/auth/register endpoint
    - Validate email format using validateEmail()
    - Validate password strength using validatePasswordStrength()
    - Check email uniqueness in database
    - Hash password using hashPassword()
    - Create user record with passwordHash, loginMethod="email", role="user"
    - Generate access token (7-day expiration) and refresh token (30-day expiration)
    - Return user data and tokens (exclude passwordHash)
    - Return 400 Bad Request for validation errors with field-level details
    - Return 400 Bad Request with "Email already in use" for duplicate emails
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 4.1, 4.2, 4.5, 4.6, 7.2, 7.6, 10.1, 10.4_
  
  - [ ]* 3.2 Write unit tests for registration endpoint
    - Test successful registration creates user with hashed password
    - Test duplicate email is rejected with 400 status
    - Test invalid email format is rejected with 400 status
    - Test password < 8 characters is rejected with 400 status
    - Test user role defaults to "user"
    - Test loginMethod is set to "email"
    - Test passwordHash is not returned in response
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_
  
  - [ ]* 3.3 Write property test for registration
    - **Property 2: Registration round trip - registered user can be retrieved with same email**
    - **Validates: Requirements 1.1, 1.5**

- [ ] 4. Implement user login endpoint
  - [ ] 4.1 Create POST /api/auth/login endpoint
    - Validate email and password are provided
    - Look up user by email in database
    - Use verifyPassword() to compare provided password against stored hash
    - Update user's lastSignedIn timestamp to current time
    - Generate access token (7-day expiration) and refresh token (30-day expiration)
    - Return user data and tokens
    - Return 400 Bad Request if email or password missing
    - Return 401 Unauthorized with generic message for invalid credentials (no email enumeration)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.2, 3.5, 4.1, 4.2, 4.5, 4.6, 7.1, 7.2_
  
  - [ ]* 4.2 Write unit tests for login endpoint
    - Test successful login with correct credentials
    - Test login fails with wrong password (401 status)
    - Test login fails with non-existent email (401 status)
    - Test lastSignedIn timestamp is updated
    - Test both access and refresh tokens are returned
    - Test generic error message doesn't reveal email existence
    - Test missing email returns 400 status
    - Test missing password returns 400 status
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  
  - [ ]* 4.3 Write property test for login
    - **Property 3: Login idempotence - multiple logins with same credentials succeed**
    - **Validates: Requirements 2.1, 2.4**

- [ ] 5. Implement token refresh endpoint
  - [ ] 5.1 Create POST /api/auth/refresh endpoint
    - Validate refresh token is provided
    - Verify refresh token validity and expiration
    - Generate new access token (7-day expiration)
    - Optionally generate new refresh token (30-day expiration)
    - Return new tokens
    - Return 400 Bad Request if refresh token missing
    - Return 401 Unauthorized if refresh token invalid or expired
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 7.4_
  
  - [ ]* 5.2 Write unit tests for refresh endpoint
    - Test successful token refresh with valid refresh token
    - Test refresh fails with invalid refresh token (401 status)
    - Test refresh fails with expired refresh token (401 status)
    - Test new access token is returned
    - Test new refresh token is optionally returned
    - _Requirements: 4.3, 4.4_

- [x] 6. Implement logout endpoint
  - [x] 6.1 Ensure POST /api/auth/logout endpoint exists
    - Endpoint should accept logout request
    - Return success response
    - _Requirements: 6.1, 6.5_
  
  - [ ]* 6.2 Write unit tests for logout endpoint
    - Test logout returns success response
    - _Requirements: 6.1_

- [-] 7. Implement authentication middleware and token verification
  - [x] 7.1 Update authentication middleware for protected routes
    - Extract token from Authorization header (Bearer scheme)
    - Verify token validity and expiration
    - Attach user info to request object
    - Return 401 Unauthorized if token missing
    - Return 401 Unauthorized if token invalid
    - Return 401 Unauthorized if token expired 
    - _Requirements: 5.4, 7.3, 7.4, 9.2, 9.3, 9.4_
  
  - [ ]* 7.2 Write unit tests for authentication middleware
    - Test valid token allows access
    - Test missing token returns 401
    - Test invalid token returns 401
    - Test expired token returns 401
    - Test user info is attached to request
    - _Requirements: 5.4, 9.2, 9.3, 9.4_

- [x] 8. Create login page component
  - [x] 8.1 Create client/src/pages/Login.tsx component
    - Display email input field with label
    - Display password input field with label
    - Display submit button
    - Implement form validation (email format, password required)
    - Call POST /api/auth/login on form submission
    - Show loading state during submission (disable button, show spinner)
    - Store accessToken and refreshToken in localStorage on success
    - Display generic error message on login failure
    - Preserve email field on error for user convenience
    - Redirect to dashboard on successful login
    - Display "Create account" link to /register route
    - _Requirements: 2.1, 2.2, 2.4, 5.1, 5.2, 5.3, 8.1, 8.4, 8.6, 8.7_
  
  - [-] 8.2 Write tests for login page

    - Test form renders with email and password fields
    - Test form validation prevents submission with invalid email
    - Test form validation prevents submission with missing password
    - Test successful login stores tokens in localStorage
    - Test successful login redirects to dashboard
    - Test error message displays on login failure
    - Test email field preserved on error
    - _Requirements: 8.1, 8.4, 8.6, 8.7_

- [ ] 9. Create registration page component
  - [ ] 9.1 Create client/src/pages/Register.tsx component
    - Display email input field with label
    - Display password input field with label
    - Display confirm password input field with label
    - Display password requirements (minimum 8 characters)
    - Implement client-side password strength validation
    - Validate password and confirm password match
    - Call POST /api/auth/register on form submission
    - Show loading state during submission (disable button, show spinner)
    - Store accessToken and refreshToken in localStorage on success
    - Display field-level error messages below each input
    - Display server errors in alert banner
    - Redirect to dashboard on successful registration
    - Display "Already have an account?" link to /login route
    - _Requirements: 1.1, 1.3, 1.4, 5.1, 5.2, 5.3, 8.2, 8.5, 8.6, 8.7_
  
  - [ ]* 9.2 Write tests for registration page
    - Test form renders with email, password, and confirm password fields
    - Test password requirements display
    - Test form validation prevents submission with invalid email
    - Test form validation prevents submission with password < 8 characters
    - Test form validation prevents submission if passwords don't match
    - Test successful registration stores tokens in localStorage
    - Test successful registration redirects to dashboard
    - Test duplicate email error displays
    - Test field-level errors display below inputs
    - _Requirements: 8.2, 8.5, 8.6, 8.7_

- [ ] 10. Add authentication routes to application router
  - [ ] 10.1 Add /login route
    - Route should render Login page component
    - Route should be accessible when not authenticated
    - Route should redirect authenticated users to dashboard
    - _Requirements: 8.1, 9.1_
  
  - [ ] 10.2 Add /register route
    - Route should render Register page component
    - Route should be accessible when not authenticated
    - Route should redirect authenticated users to dashboard
    - _Requirements: 8.2, 9.1_

- [ ] 11. Implement client-side token storage and retrieval
  - [ ] 11.1 Update token storage utilities
    - Implement localStorage storage for accessToken under key "accessToken"
    - Implement localStorage storage for refreshToken under key "refreshToken"
    - Implement token retrieval from localStorage
    - Implement token clearing from localStorage
    - _Requirements: 5.1, 5.2, 6.1, 6.2, 6.4_
  
  - [ ]* 11.2 Write tests for token storage
    - Test tokens are stored in localStorage on login
    - Test tokens are retrieved from localStorage
    - Test tokens are cleared from localStorage on logout
    - Test tokens persist across page reloads
    - _Requirements: 5.1, 5.2, 6.1, 6.2_

- [ ] 12. Implement API request interceptor for token management
  - [ ] 12.1 Update API interceptor to add Authorization header
    - Extract accessToken from localStorage
    - Add Authorization header with "Bearer {token}" format
    - Include header in all API requests
    - _Requirements: 5.3_
  
  - [ ] 12.2 Implement automatic token refresh on 401 response
    - Detect 401 Unauthorized responses
    - Attempt to refresh token using POST /api/auth/refresh
    - Retry original request with new access token
    - Redirect to /login if refresh fails
    - _Requirements: 5.5, 5.6, 9.3, 9.4_
  
  - [ ]* 12.3 Write tests for API interceptor
    - Test Authorization header is added to requests
    - Test 401 response triggers token refresh
    - Test original request is retried after refresh
    - Test redirect to login if refresh fails
    - _Requirements: 5.3, 5.5, 5.6_

- [ ] 13. Implement protected route guards
  - [ ] 13.1 Update route protection logic
    - Check if accessToken exists in localStorage
    - Verify token validity before rendering protected routes
    - Redirect to /login if token missing or invalid
    - Handle token expiration and automatic refresh
    - _Requirements: 5.4, 9.1, 9.2, 9.3, 9.4_
  
  - [ ]* 13.2 Write tests for protected routes
    - Test unauthenticated users are redirected to /login
    - Test authenticated users can access protected routes
    - Test expired token triggers redirect to /login
    - Test invalid token triggers redirect to /login
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 14. Implement logout functionality
  - [ ] 14.1 Update logout handler
    - Remove accessToken from localStorage
    - Remove refreshToken from localStorage
    - Clear cached user data from client state
    - Redirect to /login route
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [ ]* 14.2 Write tests for logout
    - Test tokens are removed from localStorage
    - Test user is redirected to /login
    - Test cached user data is cleared
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 15. Implement error handling and validation
  - [ ] 15.1 Add server-side error handling
    - Return 400 Bad Request for validation errors with field-level details
    - Return 401 Unauthorized for authentication failures with generic message
    - Return 401 Unauthorized for expired tokens
    - Return 500 Internal Server Error for server errors with logging
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  
  - [ ] 15.2 Add client-side error handling
    - Display validation errors below form fields
    - Display server errors in alert banners
    - Preserve form data on error (except password)
    - Show loading states during requests
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.6, 8.7_
  
  - [ ]* 15.3 Write tests for error handling
    - Test validation errors display correctly
    - Test server errors display correctly
    - Test form data preserved on error
    - Test loading states display correctly
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [ ] 16. Implement user profile display in header
  - [ ] 16.1 Update application header/user menu
    - Display authenticated user's email or name
    - Display logout button
    - _Requirements: 9.5_
  
  - [ ]* 16.2 Write tests for user profile display
    - Test authenticated user's email displays in header
    - Test logout button is visible
    - _Requirements: 9.5_

- [ ] 17. Checkpoint - Verify all core functionality
  - Ensure all unit tests pass
  - Ensure all integration tests pass
  - Verify registration flow works end-to-end
  - Verify login flow works end-to-end
  - Verify logout flow works end-to-end
  - Verify token refresh works automatically
  - Verify protected routes are accessible only to authenticated users
  - Ask the user if questions arise

- [ ] 18. Write integration tests
  - [ ] 18.1 Test complete registration flow
    - User registers with valid email and password
    - User receives tokens
    - User is redirected to dashboard
    - User can access protected routes
    - _Requirements: 1.1, 1.5, 1.6, 5.1, 5.2, 5.3, 5.4, 8.1, 8.2, 8.6, 8.7_
  
  - [ ] 18.2 Test complete login flow
    - User logs in with valid credentials
    - User receives tokens
    - User is redirected to dashboard
    - User can access protected routes
    - _Requirements: 2.1, 2.3, 2.4, 5.1, 5.2, 5.3, 5.4, 8.1, 8.4, 8.6, 8.7_
  
  - [ ] 18.3 Test complete logout flow
    - User logs out
    - Tokens are removed from localStorage
    - User is redirected to login page
    - User cannot access protected routes
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 9.1, 9.2, 9.3, 9.4_
  
  - [ ] 18.4 Test token refresh flow
    - User's access token expires
    - System automatically refreshes token
    - User can continue using application
    - _Requirements: 4.3, 4.4, 5.5, 5.6_
  
  - [ ] 18.5 Test error scenarios
    - Registration with duplicate email fails
    - Registration with weak password fails
    - Login with wrong password fails
    - Login with non-existent email fails
    - Access to protected routes without token fails
    - _Requirements: 1.2, 1.4, 2.2, 2.5, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 9.1, 9.2, 9.3, 9.4_

- [ ] 19. Write property-based tests
  - [ ]* 19.1 Property test: Email validation consistency
    - **Property 4: Email validation is consistent across all valid/invalid formats**
    - **Validates: Requirements 1.3, 7.2**
  
  - [ ]* 19.2 Property test: Password hashing security
    - **Property 5: Password hashing produces unique hashes for same input**
    - **Validates: Requirements 3.1, 3.2**
  
  - [ ]* 19.3 Property test: Token generation consistency
    - **Property 6: Generated tokens contain correct payload and expiration**
    - **Validates: Requirements 4.5, 4.6**
  
  - [ ]* 19.4 Property test: Token verification consistency
    - **Property 7: Token verification is consistent across valid/invalid tokens**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
  
  - [ ]* 19.5 Property test: Authentication state consistency
    - **Property 8: Authentication state remains consistent across operations**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6**

- [ ] 20. Final checkpoint - Ensure all tests pass
  - Ensure all unit tests pass
  - Ensure all integration tests pass
  - Ensure all property-based tests pass
  - Verify no security vulnerabilities
  - Verify no console errors or warnings
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints (tasks 17 and 20) ensure incremental validation
- Property tests validate universal correctness properties
- Unit and integration tests validate specific examples and edge cases
- All tasks should be completed in order due to dependencies
- Password hashing uses bcrypt with salt factor ≥ 10 for security
- Tokens use HS256 algorithm with JWT secret for signing
- Access tokens expire in 7 days, refresh tokens in 30 days
- All passwords transmitted over HTTPS only (enforced by deployment)
- Error messages are generic for security-sensitive operations (no email enumeration)
