# Quick Start Guide - Getting the App Running

## The Issue
You're seeing a 404 error because the app requires OAuth authentication to work. The OAuth configuration in `.env` is pointing to `localhost:3000` which doesn't have an OAuth provider.

## Solution: Configure GitHub OAuth (5 minutes)

### Step 1: Create GitHub OAuth App
1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: `Team Manager Dev`
   - **Homepage URL**: `http://localhost:5173`
   - **Authorization callback URL**: `http://localhost:3000/api/oauth/github/callback`
4. Click "Register application"
5. Copy your **Client ID** and **Client Secret**

### Step 2: Update .env File
Edit `team-manager/.env` and add:

```env
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
```

### Step 3: Update Login URL
Edit `team-manager/client/src/const.ts` and replace the entire `getLoginUrl` function with:

```typescript
export const getLoginUrl = () => {
  const githubClientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
  
  if (!githubClientId) {
    console.warn("GitHub OAuth not configured. Add VITE_GITHUB_CLIENT_ID to .env");
    return "/";
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

### Step 4: Add to .env.local (for Vite)
Create `team-manager/.env.local`:

```env
VITE_GITHUB_CLIENT_ID=your_client_id_here
```

### Step 5: Restart Dev Server
```bash
# Stop the current server (Ctrl+C)
# Then restart:
pnpm dev
```

### Step 6: Test the App
1. Open http://localhost:5173
2. Click "Sign in"
3. You'll be redirected to GitHub
4. Authorize the app
5. You'll be redirected back and logged in
6. Socket.io should now connect automatically

## What Happens After Login
- Your GitHub user info is stored in the database
- A JWT token is generated and stored in localStorage
- Socket.io connects using this token
- You can now access all features (Teams, Tasks, Departments, etc.)

## Troubleshooting

### Still seeing 404?
- Make sure you restarted the dev server after updating `.env`
- Clear browser cache (Ctrl+Shift+Delete)
- Check that Client ID is correct in `.env.local`

### "Invalid authentication token" error?
- The token might be expired
- Log out and log back in
- Clear localStorage: `localStorage.clear()` in browser console

### Socket.io not connecting?
- Make sure you're logged in (check localStorage for `app_access_token`)
- Check browser console for errors
- Verify backend is running on port 3000

## Alternative: Use Google OAuth

If you prefer Google:
1. Go to https://console.cloud.google.com/
2. Create project → Enable Google+ API
3. Create OAuth 2.0 credentials (Web app)
4. Add redirect URI: `http://localhost:3000/api/oauth/google/callback`
5. Add to `.env`:
   ```env
   GOOGLE_CLIENT_ID=your_id
   GOOGLE_CLIENT_SECRET=your_secret
   ```
6. Update `const.ts` to use Google OAuth

## Next Steps
Once you're logged in:
- Go to `/teams` to create a team
- Go to `/tasks` to manage tasks
- Go to `/departments` to manage departments
- Go to `/editor` for collaborative editing
- Go to `/repositories` to connect GitHub repos

## Production Deployment
For production, use real OAuth credentials and HTTPS URLs.
