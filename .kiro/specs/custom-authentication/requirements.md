# Requirements Document: Custom Authentication (Email/Password Login)

## Introduction

The Team Manager application currently uses GitHub OAuth for authentication. This feature introduces a custom email/password authentication system to provide users with an alternative login method. The system will leverage existing JWT token infrastructure (7-day access tokens, 30-day refresh tokens) and integrate with the current user management system. This enables users to create accounts and authenticate using email and password credentials while maintaining secure token-based session management.

## Glossary

- **User**: An individual who has registered for an account in the system
- **Credentials**: Email address and password combination used for authentication
- **Password Hash**: A one-way cryptographic transformation of a password using bcrypt algorithm
- **Access Token**: Short-lived JWT token (7 days) used to authenticate API requests
- **Refresh Token**: Long-lived JWT token (30 days) used to obtain new access tokens
- **Session**: An authenticated user's active connection to the system, maintained via tokens
- **Registration**: The process of creating a new user account with email and password
- **Login**: The process of authenticating an existing user with email and password
- **Logout**: The process of terminating a user session and clearing authentication tokens
- **Token Storage**: Browser localStorage mechanism for persisting access and refresh tokens
- **Validation**: The process of verifying that input data meets specified requirements
- **Authentication**: The process of verifying a user's identity through credentials
- **Authorization**: The process of determining what authenticated users are allowed to do

## Requirements

### Requirement 1: User Registration

**User Story:** As a new user, I want to create an account with my email and password, so that I can access the Team Manager application.

#### Acceptance Criteria

1. WHEN a user submits a registration form with email and password, THE System SHALL create a new user account and store the password as a bcrypt hash
2. WHEN a user attempts to register with an email that already exists, THE System SHALL reject the registration and return an error message indicating the email is already in use
3. WHEN a user submits a registration form with an invalid email format, THE System SHALL reject the registration and return a validation error
4. WHEN a user submits a registration form with a password shorter than 8 characters, THE System SHALL reject the registration and return a validation error
5. WHEN a user successfully registers, THE System SHALL set the user's loginMethod to "email" and initialize their role as "user"
6. WHEN a user successfully registers, THE System SHALL return a success response without exposing the password hash

### Requirement 2: User Login

**User Story:** As an existing user, I want to log in with my email and password, so that I can access my account and the application features.

#### Acceptance Criteria

1. WHEN a user submits valid email and password credentials, THE System SHALL verify the password against the stored hash and issue both access and refresh tokens
2. WHEN a user submits invalid credentials (wrong password or non-existent email), THE System SHALL reject the login and return a generic error message
3. WHEN a user successfully logs in, THE System SHALL update the user's lastSignedIn timestamp to the current time
4. WHEN a user successfully logs in, THE System SHALL return both access token and refresh token in the response
5. WHEN a user submits a login request with missing email or password, THE System SHALL reject the request and return a validation error

### Requirement 3: Password Security

**User Story:** As a system administrator, I want passwords to be securely hashed and never stored in plain text, so that user accounts are protected even if the database is compromised.

#### Acceptance Criteria

1. WHEN a user registers or changes their password, THE System SHALL hash the password using bcrypt with a salt factor of at least 10
2. WHEN a user logs in, THE System SHALL compare the provided password against the stored hash using bcrypt verification
3. WHEN a password is stored in the database, THE System SHALL never store the plain text password
4. WHEN a password is transmitted over the network, THE System SHALL only transmit it over HTTPS connections
5. WHEN a password verification fails, THE System SHALL not reveal whether the email exists in the system

### Requirement 4: Token Generation and Management

**User Story:** As a user, I want to receive JWT tokens upon successful login, so that I can maintain an authenticated session without re-entering credentials.

#### Acceptance Criteria

1. WHEN a user successfully logs in, THE System SHALL generate an access token with a 7-day expiration time
2. WHEN a user successfully logs in, THE System SHALL generate a refresh token with a 30-day expiration time
3. WHEN a user's access token expires, THE System SHALL allow the user to use the refresh token to obtain a new access token
4. WHEN a refresh token is used to generate a new access token, THE System SHALL return a new access token and optionally a new refresh token
5. WHEN a token is generated, THE System SHALL include the userId and email in the token payload
6. WHEN a token is generated, THE System SHALL sign it using the HS256 algorithm with the JWT secret

### Requirement 5: Session Management

**User Story:** As a user, I want my authentication tokens to be securely stored and automatically sent with API requests, so that I can maintain my session across page reloads.

#### Acceptance Criteria

1. WHEN a user successfully logs in, THE System SHALL store the access token in browser localStorage under the key "accessToken"
2. WHEN a user successfully logs in, THE System SHALL store the refresh token in browser localStorage under the key "refreshToken"
3. WHEN an API request is made, THE System SHALL automatically include the access token in the Authorization header as "Bearer {token}"
4. WHEN a user navigates to a protected page, THE System SHALL verify the access token is present and valid before allowing access
5. WHEN an access token is expired, THE System SHALL automatically attempt to refresh it using the refresh token
6. WHEN both tokens are expired or invalid, THE System SHALL redirect the user to the login page

### Requirement 6: Logout

**User Story:** As a user, I want to log out of my account, so that I can end my session and prevent unauthorized access to my account.

#### Acceptance Criteria

1. WHEN a user clicks the logout button, THE System SHALL remove the access token from localStorage
2. WHEN a user clicks the logout button, THE System SHALL remove the refresh token from localStorage
3. WHEN a user logs out, THE System SHALL redirect them to the login page
4. WHEN a user logs out, THE System SHALL clear any cached user data from the client
5. WHEN a user logs out, THE System SHALL invalidate the session on the server side (if applicable)

### Requirement 7: Error Handling and Validation

**User Story:** As a user, I want to receive clear error messages when authentication fails, so that I can understand what went wrong and take corrective action.

#### Acceptance Criteria

1. WHEN a user submits invalid credentials, THE System SHALL return a 401 Unauthorized status code with a generic error message
2. WHEN a user submits a registration request with validation errors, THE System SHALL return a 400 Bad Request status code with specific field-level error messages
3. WHEN a user attempts to access a protected resource without a valid token, THE System SHALL return a 401 Unauthorized status code
4. WHEN a user's token is expired, THE System SHALL return a 401 Unauthorized status code with a message indicating token expiration
5. WHEN a server error occurs during authentication, THE System SHALL return a 500 Internal Server Error status code and log the error for debugging
6. WHEN a user attempts to register with a password that is too weak, THE System SHALL return a 400 Bad Request with a message specifying password requirements

### Requirement 8: Login and Registration UI

**User Story:** As a user, I want to access clean and intuitive login and registration pages, so that I can easily authenticate or create an account.

#### Acceptance Criteria

1. WHEN a user is not authenticated, THE System SHALL display a login page at the /login route
2. WHEN a user is not authenticated, THE System SHALL display a registration page at the /register route
3. WHEN a user is authenticated, THE System SHALL prevent access to the login and registration pages and redirect them to the dashboard
4. WHEN a user is on the login page, THE System SHALL display form fields for email and password with appropriate labels
5. WHEN a user is on the registration page, THE System SHALL display form fields for email and password with appropriate labels and password requirements
6. WHEN a user submits a form, THE System SHALL display loading state and disable the submit button to prevent duplicate submissions
7. WHEN authentication fails, THE System SHALL display an error message on the form without clearing the email field

### Requirement 9: Protected Routes and Access Control

**User Story:** As a system administrator, I want to ensure that only authenticated users can access protected resources, so that the application remains secure.

#### Acceptance Criteria

1. WHEN an unauthenticated user attempts to access a protected route, THE System SHALL redirect them to the login page
2. WHEN an authenticated user accesses a protected route, THE System SHALL verify their access token before granting access
3. WHEN a user's access token is invalid or expired, THE System SHALL redirect them to the login page
4. WHEN a user's refresh token is also expired, THE System SHALL redirect them to the login page and clear all tokens
5. WHEN a user is authenticated, THE System SHALL display their email or name in the application header or user menu

### Requirement 10: Database Schema Updates

**User Story:** As a developer, I want the users table to support password-based authentication, so that I can store and verify user credentials.

#### Acceptance Criteria

1. WHEN a user registers with email and password, THE System SHALL add a passwordHash field to store the bcrypt hash
2. WHEN a user registers, THE System SHALL ensure the email field is unique and indexed for efficient lookups
3. WHEN a user logs in, THE System SHALL update the lastSignedIn timestamp to track user activity
4. WHEN a user is created, THE System SHALL set the loginMethod field to "email" to distinguish from OAuth users
5. WHEN the database is queried, THE System SHALL never return the passwordHash field in API responses

