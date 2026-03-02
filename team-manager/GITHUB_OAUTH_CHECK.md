# GitHub OAuth Configuration Checklist

## ⚠️ IMPORTANT: Verify Your GitHub OAuth App Settings

Go to: https://github.com/settings/developers

Click on your "Team Manager Dev" app and verify these EXACT settings:

### Required Settings:

1. **Homepage URL:**
   ```
   http://localhost:3000
   ```

2. **Authorization callback URL:**
   ```
   http://localhost:3000/api/oauth/github/callback
   ```
   ⚠️ This MUST be EXACTLY this - no trailing slash, no typos!

### Common Mistakes:

❌ `http://localhost:3000/api/oauth/callback` (missing /github/)
❌ `http://localhost:3000/api/oauth/github/callback/` (extra slash at end)
❌ `http://localhost:5173/...` (wrong port)
❌ `https://localhost:3000/...` (https instead of http)

### After Verifying:

1. Make sure the callback URL is EXACTLY: `http://localhost:3000/api/oauth/github/callback`
2. Save changes on GitHub if you made any corrections
3. Restart your dev server: Stop it (Ctrl+C) and run `npm run dev` again
4. Try logging in again

### Still Not Working?

Check your terminal for the actual error message. Look for lines that say:
```
[OAuth] GitHub callback failed
```

The detailed error will be right after that line.
