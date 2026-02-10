# ⚠️ GitHub OAuth Credentials Invalid

## Problem
The GitHub OAuth credentials you provided are returning a 404 error from GitHub, which means:
- ❌ The credentials are incorrect
- ❌ The OAuth app was deleted
- ❌ The credentials are expired

## Solution: Create a New GitHub OAuth App

### Step 1: Go to GitHub Settings
https://github.com/settings/applications/new

### Step 2: Fill in the Form
```
Application name: Team Manager Dev
Homepage URL: http://localhost:5173
Authorization callback URL: http://localhost:3000/api/oauth/github/callback
```

### Step 3: Register and Copy Credentials
After clicking "Register application", you'll see:
- **Client ID** (32 character string)
- **Client Secret** (click "Generate a new client secret")

### Step 4: Update Your Files

**Edit `team-manager/.env`:**
```env
GITHUB_CLIENT_ID=<your_new_client_id>
GITHUB_CLIENT_SECRET=<your_new_client_secret>
```

**Edit `team-manager/.env.local`:**
```env
VITE_GITHUB_CLIENT_ID=<your_new_client_id>
```

### Step 5: Restart Dev Server
```bash
pnpm dev
```

### Step 6: Test Again
Open http://localhost:5173 and click "Sign in"

---

## Why This Happened

The credentials you provided:
```
Client ID: 0b5a8df7d933db71204ecedb
Client Secret: 222a33206a6f6354Ov23li9TNXDR0uMgUbmc
```

Are either:
1. **Typo'd** - Double-check the values from GitHub
2. **Expired** - GitHub OAuth apps can expire
3. **Deleted** - The app may have been removed from GitHub
4. **Invalid format** - Client IDs should be longer (usually 20+ chars)

---

## Quick Checklist

- [ ] Go to https://github.com/settings/applications/new
- [ ] Create a new OAuth app
- [ ] Copy the Client ID (should be ~20 characters)
- [ ] Generate and copy the Client Secret (should start with `ghp_`)
- [ ] Update `.env` with both values
- [ ] Update `.env.local` with Client ID
- [ ] Restart dev server: `pnpm dev`
- [ ] Test at http://localhost:5173

---

## Need Help?

If you're still having issues:
1. Make sure you're logged into GitHub
2. Check that the OAuth app exists in your GitHub settings
3. Verify the callback URL matches exactly: `http://localhost:3000/api/oauth/github/callback`
4. Try creating a fresh OAuth app
5. Clear browser cache and localStorage

---

## Common Issues

| Issue | Solution |
|-------|----------|
| 404 from GitHub | Credentials are invalid - create new app |
| "Client ID not found" | Make sure .env.local has VITE_GITHUB_CLIENT_ID |
| "Invalid redirect URI" | Check GitHub settings - must match exactly |
| Still getting 404 | Try a different browser or incognito mode |

---

## Next Steps

1. Create a new GitHub OAuth app
2. Copy the new credentials
3. Update `.env` and `.env.local`
4. Restart dev server
5. Test again

You've got this! 🚀
