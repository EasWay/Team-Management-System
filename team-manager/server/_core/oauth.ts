import { ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { authService } from "./auth";
import { sdk } from "./sdk";
import { handleGitHubCallback, handleGoogleCallback, handleLogout, addPendingGoogleConnect } from "../oauth-callbacks";
import { storeOAuthToken } from "../oauth-token-service";
import { getProvider, generateAuthorizationUrl } from "../oauth-providers";
import crypto from "node:crypto";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  // Manus OAuth callback (existing)
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      // Get the user to store OAuth token
      const user = await db.getUserByOpenId(userInfo.openId);
      if (user) {
        // Store Manus OAuth token
        await storeOAuthToken(user.id, 'manus', {
          accessToken: tokenResponse.accessToken,
          refreshToken: tokenResponse.refreshToken,
          expiresAt: tokenResponse.expiresIn ? new Date(Date.now() + tokenResponse.expiresIn * 1000) : undefined,
        });

        // Generate JWT tokens
        const accessToken = await authService.generateAccessToken(user.id, user.email || '');
        const refreshToken = await authService.generateRefreshToken(user.id, user.email || '');

        // Redirect to frontend with tokens in URL (will be stored in localStorage)
        const redirectUrl = `/?accessToken=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(refreshToken)}`;
        res.redirect(302, redirectUrl);
      } else {
        res.status(500).json({ error: "Failed to create user" });
      }
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });

  // GitHub OAuth initiation
  app.get("/api/oauth/github", (req, res) => {
    const provider = getProvider('github');
    if (!provider) {
      return res.status(500).json({ error: "GitHub OAuth not configured" });
    }
    const isMobile = req.query.mobile === 'true';
    const randomHex = crypto.randomBytes(16).toString('hex');

    let stateValue: string;
    if (isMobile) {
      // Encode the mobile app's redirect URI in state so the callback can redirect
      // to the right scheme (exp:// in Expo Go, team-management:// in builds).
      const mobileRedirect = typeof req.query.mobile_redirect === 'string'
        ? req.query.mobile_redirect
        : 'team-management://oauth-callback';
      stateValue = `${randomHex}:mobile:${encodeURIComponent(mobileRedirect)}`;
    } else {
      stateValue = randomHex;
    }

    const url = generateAuthorizationUrl(provider, stateValue);
    res.redirect(url);
  });

  // GitHub OAuth callback — handles both web and mobile
  app.get("/api/oauth/github/callback", (req, res) => {
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    // Mobile state format: `${hex}:mobile:${encodedRedirectUri}`
    const isMobile = state.includes(':mobile:') || state.endsWith(':mobile');
    if (isMobile) {
      return handleGitHubMobileCallback(req, res);
    }
    return handleGitHubCallback(req, res);
  });

  // GitHub OAuth mobile callback — redirects to deep link with tokens
  app.get("/api/oauth/github/mobile/callback", handleGitHubMobileCallback);

  // Google OAuth — connect existing account to Google Drive (profile screen)
  app.get("/api/oauth/google/connect", async (req, res) => {
    const tokenParam = typeof req.query.token === 'string' ? req.query.token : null;
    const isMobile = req.query.mobile === 'true';
    const rawRedirect = typeof req.query.mobile_redirect === 'string'
      ? req.query.mobile_redirect : 'team-management://oauth-callback';
    const mobileRedirect = rawRedirect.startsWith('team-management://') || rawRedirect.startsWith('exp://')
      ? rawRedirect : 'team-management://oauth-callback';

    if (!tokenParam) {
      if (isMobile) return res.redirect(302, `${mobileRedirect}?error=not_authenticated`);
      return res.status(401).json({ error: 'Token required' });
    }

    try {
      const payload = await authService.verifyToken(tokenParam);
      if (!payload) throw new Error('Invalid token');

      const provider = getProvider('google');
      if (!provider) throw new Error('Google OAuth not configured');

      const stateKey = crypto.randomBytes(16).toString('hex');
      addPendingGoogleConnect(stateKey, Number(payload.userId), isMobile ? mobileRedirect : undefined);

      const url = generateAuthorizationUrl(provider, stateKey);
      res.redirect(302, url);
    } catch (err) {
      const msg = err instanceof Error ? encodeURIComponent(err.message) : 'unknown';
      if (isMobile) return res.redirect(302, `${mobileRedirect}?error=${msg}`);
      return res.status(401).json({ error: 'Authentication failed' });
    }
  });

  // Google OAuth callback
  app.get("/api/oauth/google/callback", handleGoogleCallback);

  // Logout endpoint
  app.post("/api/oauth/logout", handleLogout);
}

async function handleGitHubMobileCallback(req: any, res: any) {
  const { handleGitHubMobileCallback: mobileHandler } = await import('../oauth-callbacks');
  return mobileHandler(req, res);
}
