# Setup Summary - Get Your App Running in 5 Minutes

## What You Need to Do

### 1️⃣ Create GitHub OAuth App (2 minutes)
Go to: https://github.com/settings/applications/new

Fill in:
- **Application name**: `Team Manager Dev`
- **Homepage URL**: `http://localhost:5173`
- **Authorization callback URL**: `http://localhost:3000/api/oauth/github/callback`

Click "Register application" and copy:
- **Client ID** (32 chars)
- **Client Secret** (starts with `ghp_`)

### 2️⃣ Update .env File (1 minute)
Edit `team-manager/.env`:

Find these lines:
```env
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
```

Replace with your actual values from GitHub.

### 3️⃣ Update .env.local File (1 minute)
Edit `team-manager/.env.local`:

Find this line:
```env
VITE_GITHUB_CLIENT_ID=your_github_client_id_here
```

Replace with your Client ID from GitHub.

### 4️⃣ Restart Dev Server (1 minute)
```bash
# Stop current server (Ctrl+C)
pnpm dev
```

### 5️⃣ Test It! (1 minute)
1. Open http://localhost:5173
2. Click "Sign in"
3. Authorize with GitHub
4. Done! You're logged in 🎉

---

## Files Already Updated For You

✅ `team-manager/client/src/const.ts` - Now uses GitHub OAuth
✅ `team-manager/.env` - Added GitHub OAuth fields with instructions
✅ `team-manager/.env.local` - Created with VITE_GITHUB_CLIENT_ID field

---

## What to Copy from GitHub

After registering your OAuth app on GitHub, you'll see:

```
Client ID: abc123def456ghi789jkl012
Client Secret: ghp_1234567890abcdefghijklmnopqrstuvwxyz
```

**Copy these two values into:**
1. `.env` file (both values)
2. `.env.local` file (Client ID only)

---

## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| Still seeing 404 | Restart dev server after updating .env |
| "Client ID not found" | Make sure .env.local has VITE_GITHUB_CLIENT_ID |
| "Invalid redirect URI" | Check GitHub settings - must be exactly `http://localhost:3000/api/oauth/github/callback` |
| Socket.io "Reconnecting" | Normal during login - should connect after auth |
| "Invalid token" | Clear localStorage: `localStorage.clear()` in console |

---

## After You're Logged In

You can access:
- **Teams** (`/teams`) - Create and manage teams
- **Tasks** (`/tasks`) - Real-time task management
- **Departments** (`/departments`) - Organizational structure
- **Editor** (`/editor`) - Collaborative editing
- **Repositories** (`/repositories`) - GitHub integration
- **Team Members** (`/team`) - Team management

---

## Need Help?

See these files for more details:
- `GITHUB_OAUTH_SETUP.md` - Detailed GitHub OAuth setup
- `SETUP_CHECKLIST.md` - Step-by-step checklist
- `OAUTH_FORM_FILLED.txt` - Exact form values to enter
- `QUICK_START.md` - Quick start guide
- `OAUTH_SETUP.md` - OAuth configuration details

---

## TL;DR

1. Create GitHub OAuth app: https://github.com/settings/applications/new
2. Copy Client ID and Secret
3. Paste into `.env` and `.env.local`
4. Restart dev server: `pnpm dev`
5. Login at http://localhost:5173
6. Done! 🚀
