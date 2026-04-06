// Meta (Facebook/Instagram) OAuth routes for Express
// Handles connecting Facebook Page and Instagram Business accounts to teams
// Uses raw SQL like other Express routes in this project

import { Request, Response } from "express";
import pkg from 'pg';
const { Pool } = pkg;

const META_APP_ID = process.env.META_APP_ID || '1754806639211913';
const META_APP_SECRET = process.env.META_APP_SECRET || '1e4a6cee9fd6e666553e25d2f0682bf0';
const META_REDIRECT_URI = process.env.META_REDIRECT_URI || 'https://team-management-system-zq6x.onrender.com';

// Database pool - reuse existing connection from process.env.DATABASE_URL
function getPool() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  return pool;
}

/**
 * Core logic to process Meta OAuth callback
 * Used by both the legacy callback route and the root URL interceptor
 */
async function processMetaOAuthCallback(req: Request, res: Response) {
  const { code, state, error, error_description } = req.query;
  
  if (error) {
    return res.redirect(`/teams?meta_error=${error_description || error}`);
  }
  
  if (!code || !state) {
    return res.redirect('/teams?meta_error=Missing parameters');
  }
  
  // Decode state
  let teamId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state as string, 'base64').toString());
    teamId = decoded.teamId;
  } catch {
    return res.redirect('/teams?meta_error=Invalid state');
  }
  
  const pool = getPool();
  try {
    // Exchange code for access token
    const tokenUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', META_APP_ID);
    tokenUrl.searchParams.set('client_secret', META_APP_SECRET);
    tokenUrl.searchParams.set('redirect_uri', META_REDIRECT_URI);
    tokenUrl.searchParams.set('code', code as string);
    
    const tokenResponse = await fetch(tokenUrl.toString());
    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      throw new Error(tokenData.error?.message || 'Failed to get access token');
    }
    
    const accessToken = tokenData.access_token;
    
    // Get user's Facebook pages
    const pagesUrl = new URL('https://graph.facebook.com/v18.0/me/accounts');
    pagesUrl.searchParams.set('access_token', accessToken);
    
    const pagesResponse = await fetch(pagesUrl.toString());
    const pagesData = await pagesResponse.json();
    
    const pages = pagesData.data || [];
    const firstPage = pages[0];
    
    // Get Instagram business account
    let instagramAccount = null;
    if (firstPage) {
      const igUrl = new URL(`https://graph.facebook.com/v18.0/${firstPage.id}`);
      igUrl.searchParams.set('fields', 'instagram_business_account');
      igUrl.searchParams.set('access_token', accessToken);
      
      const igResponse = await fetch(igUrl.toString());
      const igData = await igResponse.json();
      
      if (igData.instagram_business_account) {
        const igDetailsUrl = new URL(`https://graph.facebook.com/v18.0/${igData.instagram_business_account.id}`);
        igDetailsUrl.searchParams.set('fields', 'username,name');
        igDetailsUrl.searchParams.set('access_token', accessToken);
        
        const igDetailsResponse = await fetch(igDetailsUrl.toString());
        const igDetails = await igDetailsResponse.json();
        
        instagramAccount = {
          id: igData.instagram_business_account.id,
          username: igDetails.username,
        };
      }
    }
    
    const teamIdNum = parseInt(teamId);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    
    // Upsert using raw SQL
    await pool.query(`
      INSERT INTO meta_accounts (team_id, page_id, page_name, page_access_token, instagram_id, instagram_username, token_expires_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      ON CONFLICT (team_id) DO UPDATE SET
        page_id = EXCLUDED.page_id,
        page_name = EXCLUDED.page_name,
        page_access_token = EXCLUDED.page_access_token,
        instagram_id = EXCLUDED.instagram_id,
        instagram_username = EXCLUDED.instagram_username,
        token_expires_at = EXCLUDED.token_expires_at,
        updated_at = NOW()
    `, [teamIdNum, firstPage?.id || null, firstPage?.name || null, firstPage?.access_token || null, instagramAccount?.id || null, instagramAccount?.username || null, expiresAt]);
    
    await pool.end();
    return res.redirect('/teams?meta_connected=true');
  } catch (err: any) {
    console.error('Meta OAuth error:', err);
    await pool.end();
    return res.redirect(`/teams?meta_error=${encodeURIComponent(err.message)}`);
  }
}

export function registerMetaRoutes(app: any) {
  // Intercept root URL for Meta OAuth callback from gateway
  app.get('/', (req: Request, res: Response, next: any) => {
    const { code, state, error } = req.query;
    // If code/state or error are present, specifically treat this as a Meta OAuth callback
    if (code || error) {
      console.log('[Meta] Intercepted OAuth callback at root URL');
      return processMetaOAuthCallback(req, res);
    }
    next();
  });

  // Initiate Meta OAuth via Alpha Callback Gateway
  app.get('/api/meta/connect', async (req: Request, res: Response) => {
    const { team_id } = req.query;
    
    if (!team_id) {
      return res.redirect('/?meta_error=Missing team_id');
    }
    
    // Generate state parameter for CSRF protection
    const state = Buffer.from(JSON.stringify({ teamId: team_id })).toString('base64');
    
    // Redirect to Alpha Callback Gateway instead of direct Facebook dialog
    const gatewayUrl = `https://alpha-callback-gateway.onrender.com/auth/meta/login?client_id=49b78800-4d40-4077-a7ad-24ecdcc9f87e&state=${state}`;
    
    console.log('[Meta] Redirecting to Alpha Callback Gateway:', gatewayUrl);
    return res.redirect(gatewayUrl);
  });

  // Handle Meta OAuth callback (legacy route, still supported if redirect URI is changed back)
  app.get('/api/meta/callback', async (req: Request, res: Response) => {
    return processMetaOAuthCallback(req, res);
  });

  // Get connected Meta account for a team
  app.get('/api/meta/account/:teamId', async (req: Request, res: Response) => {
    const { teamId } = req.params;
    
    const pool = getPool();
    try {
      const teamIdNum = parseInt(teamId);
      const result = await pool.query('SELECT * FROM meta_accounts WHERE team_id = $1', [teamIdNum]);
      
      await pool.end();
      
      if (result.rows.length === 0) {
        return res.json({ connected: false });
      }
      
      const account = result.rows[0];
      const tokenExpired = account.token_expires_at && new Date(account.token_expires_at) < new Date();
      
      return res.json({
        connected: true,
        page: {
          id: account.page_id,
          name: account.page_name,
        },
        instagram: {
          id: account.instagram_id,
          username: account.instagram_username,
        },
        tokenExpired,
      });
    } catch (err: any) {
      console.error('Error fetching meta account:', err);
      await pool.end();
      return res.status(500).json({ error: err.message });
    }
  });

  // Disconnect Meta account
  app.post('/api/meta/disconnect', async (req: Request, res: Response) => {
    const { team_id } = req.body;
    
    const pool = getPool();
    try {
      const teamIdNum = parseInt(team_id);
      await pool.query('DELETE FROM meta_accounts WHERE team_id = $1', [teamIdNum]);
      
      await pool.end();
      return res.json({ success: true });
    } catch (err: any) {
      console.error('Error disconnecting meta account:', err);
      await pool.end();
      return res.status(500).json({ error: err.message });
    }
  });
}