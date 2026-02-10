# Visual Setup Guide 🎨

## Step 1: Create GitHub OAuth App

### Go to this URL:
```
https://github.com/settings/applications/new
```

### You'll see this form:

```
┌─────────────────────────────────────────────────────────────┐
│ Register a new OAuth app                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Application name *                                          │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Team Manager Dev                                        │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Homepage URL *                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ http://localhost:5173                                   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Application description                                     │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ A collaborative team management platform with           │ │
│ │ real-time task synchronization                          │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Authorization callback URL *                                │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ http://localhost:3000/api/oauth/github/callback         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ☐ Enable Device Flow                                        │
│                                                             │
│ [Register application]  [Cancel]                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Click "Register application"

---

## Step 2: Copy Your Credentials

### You'll see this page:

```
┌─────────────────────────────────────────────────────────────┐
│ OAuth apps                                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Team Manager Dev                                            │
│                                                             │
│ Client ID                                                   │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ abc123def456ghi789jkl012                                │ │ ← COPY THIS
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Client Secret                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [Generate a new client secret]                          │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Click "Generate a new client secret"

```
┌─────────────────────────────────────────────────────────────┐
│ Client Secret                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ghp_1234567890abcdefghijklmnopqrstuvwxyz               │ │ ← COPY THIS
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ⚠️ Make sure to copy your new personal access token now.   │
│    You won't be able to see it again!                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Step 3: Update .env File

### Open: `team-manager/.env`

### Find these lines:
```env
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
```

### Replace with your values:
```env
GITHUB_CLIENT_ID=abc123def456ghi789jkl012
GITHUB_CLIENT_SECRET=ghp_1234567890abcdefghijklmnopqrstuvwxyz
```

---

## Step 4: Update .env.local File

### Open: `team-manager/.env.local`

### Find this line:
```env
VITE_GITHUB_CLIENT_ID=your_github_client_id_here
```

### Replace with your Client ID:
```env
VITE_GITHUB_CLIENT_ID=abc123def456ghi789jkl012
```

---

## Step 5: Restart Dev Server

### In your terminal:
```bash
# Stop the current server
Ctrl+C

# Restart
pnpm dev
```

### You should see:
```
  VITE v5.0.0  ready in 123 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

---

## Step 6: Test the App

### Open your browser:
```
http://localhost:5173
```

### You should see:
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│              Sign in to continue                            │
│                                                             │
│    Access to this dashboard requires authentication.        │
│                                                             │
│                  [Sign in]                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Click "Sign in"

### You'll be redirected to GitHub:
```
┌─────────────────────────────────────────────────────────────┐
│ Authorize Team Manager Dev                                  │
│                                                             │
│ Team Manager Dev by [your-username]                         │
│ wants to access your account                                │
│                                                             │
│ This application will be able to:                           │
│ • Read your public profile and email address                │
│                                                             │
│ [Authorize Team Manager Dev]  [Cancel]                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Click "Authorize Team Manager Dev"

### You'll be redirected back to the app:
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│              Welcome to Team Manager!                       │
│                                                             │
│    Running in development mode. Manage your team members    │
│    and departments.                                         │
│                                                             │
│    [Team Members]  [Departments]                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Success! 🎉

---

## Troubleshooting

### Still seeing 404?
```
1. Make sure you restarted the dev server
2. Clear browser cache (Ctrl+Shift+Delete)
3. Clear localStorage: localStorage.clear() in console
4. Refresh the page
```

### "Client ID not found" warning?
```
1. Check .env.local has VITE_GITHUB_CLIENT_ID
2. Make sure the value matches your GitHub Client ID
3. Restart dev server
4. Clear browser cache
```

### "Invalid redirect URI" from GitHub?
```
1. Check GitHub settings
2. Authorization callback URL must be EXACTLY:
   http://localhost:3000/api/oauth/github/callback
3. No trailing slashes, no extra spaces
4. Restart dev server
```

---

## What's Next?

Once you're logged in, you can:

1. **Create a Team** (`/teams`)
   - Click "Create Team"
   - Enter team name
   - Invite members

2. **Manage Tasks** (`/tasks`)
   - Create tasks
   - Assign to team members
   - Watch real-time updates

3. **Organize Departments** (`/departments`)
   - Create departments
   - Assign team members
   - View organizational charts

4. **Collaborative Editing** (`/editor`)
   - Create documents
   - Edit together in real-time
   - See live cursor positions

5. **GitHub Integration** (`/repositories`)
   - Connect GitHub repos
   - View pull requests
   - Track commits

---

## Files You Modified

✅ `team-manager/.env` - Added GitHub OAuth credentials
✅ `team-manager/.env.local` - Created with VITE_GITHUB_CLIENT_ID
✅ `team-manager/client/src/const.ts` - Updated to use GitHub OAuth

All set! Enjoy your app! 🚀
