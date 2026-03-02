# OAuth Diagnostic Guide

## Current Issue
The access token is coming back as `undefined`, which means GitHub's token exchange is not returning a valid token.

## What I've Added
I've added detailed logging to help us diagnose the issue. The server will now show:
1. What parameters are being sent to GitHub
2. What GitHub is returning
3. Whether the access_token field exists

## Next Steps

### 1. Restart Your Server
```bash
# Press Ctrl+C to stop
# Then run:
npm run dev
```

### 2. Try Logging In
1. Go to http://localhost:3000
2. Click "Sign in"
3. Authorize on GitHub

### 3. Check Terminal Output
Look for these NEW log messages:

```
[OAuth] Exchanging code for token with params: { ... }
[OAuth] Token exchange response: { ... }
[OAuth] Getting user info with token: ...
```

### 4. What to Look For

#### If you see:
```json
[OAuth] Token exchange response: {
  "access_token": "gho_xxxxx...",
  "token_type": "bearer",
  "scope": "..."
}
```
✅ Token exchange worked! The issue is elsewhere.

#### If you see:
```json
[OAuth] Token exchange response: {
  "error": "bad_verification_code",
  "error_description": "..."
}
```
❌ The authorization code is invalid or expired. Try logging in again.

#### If you see:
```json
[OAuth] Token exchange response: {
  "error": "incorrect_client_credentials",
  "error_description": "..."
}
```
❌ Your Client ID or Client Secret is wrong!

## Common Issues

### Issue 1: Wrong Client Secret Format
Your current secret: `d746f8d02f2d598262fda534665029d4ed3aec2d`

This looks like a SHA hash, not a GitHub OAuth secret. GitHub secrets should look like:
- `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` (40 chars)
- Or a similar format starting with a prefix

### Issue 2: Wrong Callback URL
Your GitHub OAuth app MUST have this EXACT callback URL:
```
http://localhost:3000/api/oauth/github/callback
```

Check at: https://github.com/settings/developers

### Issue 3: Client ID/Secret Mismatch
The Client ID and Secret must be from the SAME OAuth app.

## How to Fix

### Step 1: Verify Your GitHub OAuth App
1. Go to: https://github.com/settings/developers
2. Click on your OAuth app
3. Verify:
   - **Client ID**: Should match `Ov23liTUtMn1hUeOPBHF`
   - **Callback URL**: Must be `http://localhost:3000/api/oauth/github/callback`

### Step 2: Generate a FRESH Client Secret
1. In your GitHub OAuth app settings
2. Scroll to "Client secrets"
3. Click "Generate a new client secret"
4. Copy the ENTIRE secret (it's long!)
5. It should look like: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Step 3: Update .env
Replace the secret in `team-manager/.env`:
```env
GITHUB_CLIENT_SECRET=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
(Use YOUR actual secret!)

### Step 4: Restart and Test
1. Stop server (Ctrl+C)
2. Run `npm run dev`
3. Try logging in
4. Send me the `[OAuth]` log messages

## Still Not Working?

Send me the COMPLETE output from your terminal after trying to log in, especially:
- All lines starting with `[OAuth]`
- Any error messages

This will tell us exactly what GitHub is returning and why it's failing.
