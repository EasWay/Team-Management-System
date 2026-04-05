// Meta (Facebook/Instagram) OAuth routes for Express
// Handles connecting Facebook Page and Instagram Business accounts to teams

import { Request, Response } from "express";
import { sql } from "../db.js";

const META_APP_ID = process.env.META_APP_ID || '1754806639211913';
const META_APP_SECRET = process.env.META_APP_SECRET || '1e4a6cee9fd6e666553e25d2f0682bf0';
const META_REDIRECT_URI = process.env.META_REDIRECT_URI || 'https://team-management-system-zq6x.onrender.com/api/meta/callback';

export function registerMetaRoutes(app: any) {
  // Initiate Meta OAuth
  app.get('/api/meta/connect', async (req: Request, res: Response) => {
    const { team_id } = req.query;
    
    if (!team_id) {
      return res.redirect('/?meta_error=Missing team_id');
    }
    
    // Generate state parameter for CSRF protection
    const state = Buffer.from(JSON.stringify({ teamId: team_id })).toString('base64');
    
    // Meta OAuth URL
    const authUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth');
    authUrl.searchParams.set('client_id', META_APP_ID);
    authUrl.searchParams.set('redirect_uri', META_REDIRECT_URI);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('scope', 'pages_show_list,pages_manage_metadata,instagram_basic,instagram_content_publish,instagram_manage_insights');
    
    return res.redirect(authUrl.toString());
  });

  // Handle Meta OAuth callback
  app.get('/api/meta/callback', async (req: Request, res: Response) => {
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
      
      // Store in database - use direct SQL
      const teamIdNum = parseInt(teamId);
      
      // Check if connection exists
      const existing = await sql`SELECT id FROM meta_accounts WHERE team_id = ${teamIdNum}`;
      
      if (existing.length > 0) {
        // Update
        await sql`
          UPDATE meta_accounts SET
            page_id = ${firstPage?.id || null},
            page_name = ${firstPage?.name || null},
            page_access_token = ${firstPage?.access_token || null},
            instagram_id = ${instagramAccount?.id || null},
            instagram_username = ${instagramAccount?.username || null},
            token_expires_at = ${new Date(Date.now() + 60 * 60 * 1000).toISOString()},
            updated_at = NOW()
          WHERE team_id = ${teamIdNum}
        `;
      } else {
        // Insert
        await sql`
          INSERT INTO meta_accounts (
            team_id, page_id, page_name, page_access_token,
            instagram_id, instagram_username, token_expires_at, created_at, updated_at
          ) VALUES (
            ${teamIdNum}, ${firstPage?.id || null}, ${firstPage?.name || null}, ${firstPage?.access_token || null},
            ${instagramAccount?.id || null}, ${instagramAccount?.username || null},
            ${new Date(Date.now() + 60 * 60 * 1000).toISOString()}, NOW(), NOW()
          )
        `;
      }
      
      return res.redirect('/teams?meta_connected=true');
    } catch (err: any) {
      console.error('Meta OAuth error:', err);
      return res.redirect(`/teams?meta_error=${encodeURIComponent(err.message)}`);
    }
  });

  // Get connected Meta account for a team
  app.get('/api/meta/account/:teamId', async (req: Request, res: Response) => {
    const { teamId } = req.params;
    
    try {
      const teamIdNum = parseInt(teamId);
      const result = await sql`
        SELECT id, team_id, page_id, page_name, instagram_id, instagram_username, token_expires_at, created_at
        FROM meta_accounts
        WHERE team_id = ${teamIdNum}
      `;
      
      if (result.length === 0) {
        return res.json({ connected: false });
      }
      
      const account = result[0];
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
      return res.status(500).json({ error: err.message });
    }
  });

  // Disconnect Meta account
  app.post('/api/meta/disconnect', async (req: Request, res: Response) => {
    const { team_id } = req.body;
    
    try {
      const teamIdNum = parseInt(team_id);
      await sql`DELETE FROM meta_accounts WHERE team_id = ${teamIdNum}`;
      
      return res.json({ success: true });
    } catch (err: any) {
      console.error('Error disconnecting meta account:', err);
      return res.status(500).json({ error: err.message });
    }
  });
}