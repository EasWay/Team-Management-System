# GitHub OAuth Setup - Step by Step

## Fill in the GitHub OAuth Form

You're on the right page! Here's what to fill in each field:

### 1. Application name
**Enter**: `Team Manager Dev`

This is what users will see when they authorize your app.

### 2. Homepage URL
**Enter**: `http://localhost:5173`

This is the URL of your application (the frontend running on port 5173).

### 3. Application description (Optional)
**Enter**: `A collaborative team management platform with real-time task synchronization`

This helps users understand what your app does.

### 4. Authorization callback URL (IMPORTANT!)
**Enter**: `http://localhost:3000/api/oauth/github/callback`

This is where GitHub will redirect users after they authorize. This MUST match exactly what's in your code.

### 5. Enable Device Flow
**Leave unchecked** - We don't need this for web app authentication.

---

## After Registering

Once you click "Register application", you'll see:
- **Client ID** - Copy this
- **Client Secret** - Click "Generate a new client secret" and copy it

---

## Update Your .env File

After getting the credentials, edit `team-manager/.env`:

```env
# Add these lines (replace with your actual values):
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
```

Example (with fake values):
```env
GITHUB_CLIENT_ID=abc123def456ghi789
GITHUB_CLIENT_SECRET=ghp_1234567890abcdefghijklmnopqrstuvwxyz
```

---

## Update const.ts

Edit `team-manager/client/src/const.ts` and replace the entire file with:

```typescript
export { TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY, ONE_YEAR_MS } from "@shared/const";

// GitHub OAuth login URL
export const getLoginUrl = () => {
  const githubClientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
  
  if (!githubClientId) {
    console.warn("GitHub OAuth not configured. Add VITE_GITHUB_CLIENT_ID to .env.local");
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

---

## Create .env.local

Create a new file `team-manager/.env.local`:

```env
VITE_GITHUB_CLIENT_ID=your_client_id_here
```

Replace `your_client_id_here` with the Client ID you got from GitHub.

---

## Restart Dev Server

```bash
# Stop the current server (Ctrl+C)
# Then restart:
pnpm dev
```

---

## Test It

1. Open http://localhost:5173
2. Click "Sign in"
3. You'll be redirected to GitHub
4. Click "Authorize"
5. You'll be logged in!

---

## Troubleshooting

### "Invalid redirect URI"
- Make sure the Authorization callback URL in GitHub settings is exactly: `http://localhost:3000/api/oauth/github/callback`
- Restart the dev server after changing it

### "Client ID not found"
- Make sure you added `VITE_GITHUB_CLIENT_ID` to `.env.local`
- Restart the dev server
- Clear browser cache

### Still getting 404?
- Clear localStorage: Open DevTools → Console → `localStorage.clear()`
- Refresh the page
- Try logging in again

### "Reconnecting..." at bottom?
- This is normal while logging in
- Once you're authenticated, Socket.io will connect automatically
