# OAuth Setup Checklist

Follow these steps to get your app running:

## Step 1: Create GitHub OAuth App ✓
- [ ] Go to https://github.com/settings/applications/new
- [ ] Fill in the form with these exact values:
  - **Application name**: `Team Manager Dev`
  - **Homepage URL**: `http://localhost:5173`
  - **Authorization callback URL**: `http://localhost:3000/api/oauth/github/callback`
- [ ] Click "Register application"
- [ ] Copy your **Client ID** (32 character string)
- [ ] Click "Generate a new client secret"
- [ ] Copy your **Client Secret** (starts with `ghp_`)

## Step 2: Update .env File ✓
Edit `team-manager/.env` and replace:
```env
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
```

With your actual values from GitHub:
```env
GITHUB_CLIENT_ID=abc123def456ghi789jkl012
GITHUB_CLIENT_SECRET=ghp_1234567890abcdefghijklmnopqrstuvwxyz
```

## Step 3: Update .env.local File ✓
Edit `team-manager/.env.local` and replace:
```env
VITE_GITHUB_CLIENT_ID=your_github_client_id_here
```

With your Client ID:
```env
VITE_GITHUB_CLIENT_ID=abc123def456ghi789jkl012
```

## Step 4: Verify const.ts ✓
Check that `team-manager/client/src/const.ts` has been updated to use GitHub OAuth.
It should have the `getLoginUrl()` function that redirects to GitHub.

## Step 5: Restart Dev Server ✓
```bash
# Stop the current server (Ctrl+C)
# Then restart:
pnpm dev
```

## Step 6: Test the App ✓
1. Open http://localhost:5173 in your browser
2. You should see the login page
3. Click "Sign in"
4. You'll be redirected to GitHub
5. Click "Authorize" to authorize the app
6. You'll be redirected back to the app
7. You should now be logged in!
8. Socket.io should connect automatically (check console)

## Troubleshooting

### Issue: Still seeing 404 error
**Solution**:
- Make sure you restarted the dev server after updating `.env` and `.env.local`
- Clear browser cache (Ctrl+Shift+Delete)
- Clear localStorage: Open DevTools → Console → `localStorage.clear()`
- Refresh the page

### Issue: "Client ID not found" warning
**Solution**:
- Make sure `VITE_GITHUB_CLIENT_ID` is in `.env.local`
- Make sure the value matches your GitHub Client ID
- Restart the dev server
- Clear browser cache

### Issue: "Invalid redirect URI" error from GitHub
**Solution**:
- Make sure the Authorization callback URL in GitHub settings is EXACTLY:
  `http://localhost:3000/api/oauth/github/callback`
- No trailing slashes, no extra spaces
- Restart the dev server

### Issue: Socket.io showing "Reconnecting..."
**Solution**:
- This is normal while logging in
- Once you're authenticated, it should connect
- Check browser console for errors
- Make sure you're logged in (check localStorage for `app_access_token`)

### Issue: "Invalid authentication token" error
**Solution**:
- Clear localStorage: `localStorage.clear()`
- Log out and log back in
- Make sure JWT_SECRET in `.env` is the same on both client and server

## What Happens After Login

1. Your GitHub user info is stored in the database
2. A JWT token is generated and stored in localStorage
3. Socket.io connects using this token
4. You can now access all features:
   - `/teams` - Create and manage teams
   - `/tasks` - Manage tasks with real-time sync
   - `/departments` - Manage departments
   - `/editor` - Collaborative editing
   - `/repositories` - GitHub integration
   - `/team` - Team members management

## Files Modified

- `team-manager/.env` - Added GitHub OAuth credentials
- `team-manager/.env.local` - Created with VITE_GITHUB_CLIENT_ID
- `team-manager/client/src/const.ts` - Updated to use GitHub OAuth

## Next Steps

Once you're logged in and the app is working:
1. Create a team
2. Add team members
3. Create tasks
4. Test real-time synchronization
5. Try collaborative editing
6. Connect GitHub repositories

Enjoy! 🚀
