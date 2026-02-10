# OAuth Setup Guide

## Current Issue
The app is showing a 404 error because the OAuth configuration is incomplete. The `.env` file points to `localhost:3000` as the OAuth portal, but there's no actual OAuth provider running there.

## Solution: Use GitHub OAuth (Recommended for Development)

### Step 1: Create a GitHub OAuth Application

1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in the form:
   - **Application name**: Team Manager Dev
   - **Homepage URL**: `http://localhost:5173`
   - **Authorization callback URL**: `http://localhost:3000/api/oauth/github/callback`
4. Click "Register application"
5. You'll get:
   - **Client ID**
   - **Client Secret** (click "Generate a new client secret")

### Step 2: Update .env File

Add these to your `.env` file:

```env
# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
```

### Step 3: Update Login URL Configuration

The app needs to know which OAuth provider to use. Update `team-manager/client/src/const.ts` to use GitHub:

```typescript
export const getLoginUrl = () => {
  const githubClientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
  
  if (!githubClientId) {
    console.warn("GitHub OAuth not configured");
    return "/login-not-configured";
  }
  
  const redirectUri = `${window.location.origin}/api/oauth/github/callback`;
  const state = btoa(redirectUri);
  
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', githubClientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', 'user:email');
  
  return url.toString();
};
```

### Step 4: Add GitHub Client ID to Vite Config

Create or update `team-manager/.env.local`:

```env
VITE_GITHUB_CLIENT_ID=your_github_client_id_here
```

### Step 5: Restart the App

```bash
pnpm dev
```

## Alternative: Use Google OAuth

If you prefer Google OAuth:

1. Go to https://console.cloud.google.com/
2. Create a new project
3. Enable Google+ API
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URI: `http://localhost:3000/api/oauth/google/callback`
6. Add to `.env`:
   ```env
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   ```

## Testing the OAuth Flow

1. Start the app: `pnpm dev`
2. Navigate to http://localhost:5173
3. Click "Sign in"
4. You'll be redirected to GitHub (or your chosen provider)
5. Authorize the application
6. You'll be redirected back to the app with a token
7. The app should now work and Socket.io should connect

## Troubleshooting

### "Page Not Found" Error
- Make sure OAuth is configured in `.env`
- Check that the redirect URI matches exactly in both GitHub settings and your code
- Restart the dev server after changing `.env`

### "Invalid authentication token"
- Clear browser localStorage: `localStorage.clear()`
- Log out and log back in
- Check that JWT_SECRET in `.env` matches on both client and server

### Socket.io Connection Issues
- Make sure you're logged in (token should be in localStorage)
- Check browser console for connection errors
- Verify Socket.io server is running on port 3000

## Production Deployment

For production:
1. Use real OAuth provider credentials
2. Update redirect URIs to your production domain
3. Set strong JWT_SECRET
4. Use HTTPS for all OAuth redirects
5. Store secrets in environment variables, not in code
