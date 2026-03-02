# Fix OAuth Secret - Step by Step

## The Problem:
Your GitHub Client Secret is invalid. The access token is coming back as `undefined`.

## Quick Fix (5 minutes):

### Step 1: Get a NEW Client Secret from GitHub

1. Go to: **https://github.com/settings/developers**

2. Click on your OAuth app (probably "Team Manager Dev")

3. Scroll down to the **"Client secrets"** section

4. Click the green button: **"Generate a new client secret"**

5. GitHub will show you a NEW secret that looks like:
   ```
   ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
   
6. **COPY THIS SECRET IMMEDIATELY!** (You can't see it again)

### Step 2: Update Your .env File

Open: `team-manager/.env`

Find this line:
```env
GITHUB_CLIENT_SECRET=5d3377eb099efcc74083600abe37cb8943684d8d
```

Replace it with your NEW secret:
```env
GITHUB_CLIENT_SECRET=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
(Use YOUR actual new secret!)

**SAVE THE FILE** (Ctrl+S)

### Step 3: Restart the Server

In your terminal:
1. Press `Ctrl+C` to stop the server
2. Run: `npm run dev`
3. Wait for "Server running on http://localhost:3000/"

### Step 4: Try Logging In Again

1. Go to: http://localhost:3000
2. Click "Sign in"
3. Authorize on GitHub
4. You should be logged in! ✅

---

## Why This Happened:

GitHub Client Secrets can be:
- Regenerated (making old ones invalid)
- Copied incorrectly
- From a different OAuth app

The secret `5d3377eb099efcc74083600abe37cb8943684d8d` doesn't match your Client ID `Ov23liTUtMn1hUeOPBHF`, so GitHub rejected it.

---

## Verification:

After updating, you should see in the terminal:
- ✅ No more "Authorization: Bearer undefined"
- ✅ No more 401 Unauthorized errors
- ✅ Successful login and redirect

If you still see errors, copy the ENTIRE error message and we'll debug further.
