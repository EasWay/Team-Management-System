// Meta (Facebook/Instagram) OAuth Integration
// Connects team accounts to Facebook Pages and Instagram Business

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sql } from './db.js';

const META_APP_ID = process.env.META_APP_ID || '1754806639211913';
const META_APP_SECRET = process.env.META_APP_SECRET || '1e4a6cee9fd6e666553e25d2f0682bf0';
// Use Render URL in production, localhost in development
const isDev = process.env.NODE_ENV === 'development';
const META_REDIRECT_URI = process.env.META_REDIRECT_URI || (isDev ? 'http://localhost:3000/api/meta/callback' : 'https://team-management-system-zq6x.onrender.com/api/meta/callback');

export async function metaRoutes(fastify: FastifyInstance) {
  // Initiate Meta OAuth - redirect user to Meta login
  fastify.get('/api/meta/connect', {
    schema: {
      querystring: z.object({
        team_id: z.string(),
      }),
    },
  }, async (request, reply) => {
    const { team_id } = request.query as { team_id: string };
    
    // Generate state parameter for CSRF protection
    const state = Buffer.from(JSON.stringify({ team_id })).toString('base64');
    
    // Meta OAuth URL for pages and Instagram
    const authUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth');
    authUrl.searchParams.set('client_id', META_APP_ID);
    authUrl.searchParams.set('redirect_uri', META_REDIRECT_URI);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('scope', 'pages_show_list,pages_manage_metadata,instagram_basic,instagram_content_publish,instagram_manage_insights');
    
    return reply.redirect(authUrl.toString());
  });

  // Handle Meta OAuth callback
  fastify.get('/api/meta/callback', {
    schema: {
      querystring: z.object({
        code: z.string().optional(),
        state: z.string().optional(),
        error: z.string().optional(),
        error_description: z.string().optional(),
      }),
    },
  }, async (request, reply) => {
    const { code, state, error, error_description } = request.query as any;
    
    if (error) {
      return reply.redirect(`/settings?meta_error=${error_description || error}`);
    }
    
    if (!code || !state) {
      return reply.redirect('/settings?meta_error=Missing parameters');
    }
    
    // Decode state to get team_id
    let teamId: string;
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
      teamId = decoded.team_id;
    } catch {
      return reply.redirect('/settings?meta_error=Invalid state');
    }
    
    try {
      // Exchange code for access token
      const tokenUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
      tokenUrl.searchParams.set('client_id', META_APP_ID);
      tokenUrl.searchParams.set('client_secret', META_APP_SECRET);
      tokenUrl.searchParams.set('redirect_uri', META_REDIRECT_URI);
      tokenUrl.searchParams.set('code', code);
      
      const tokenResponse = await fetch(tokenUrl.toString());
      const tokenData = await tokenResponse.json() as any;
      
      if (!tokenData.access_token) {
        throw new Error(tokenData.error?.message || 'Failed to get access token');
      }
      
      const accessToken = tokenData.access_token;
      
      // Get user's Facebook pages
      const pagesUrl = new URL('https://graph.facebook.com/v18.0/me/accounts');
      pagesUrl.searchParams.set('access_token', accessToken);
      
      const pagesResponse = await fetch(pagesUrl.toString());
      const pagesData = await pagesResponse.json() as any;
      
      const pages = pagesData.data || [];
      
      // Get Instagram business account for first page
      let instagramAccount = null;
      if (pages.length > 0) {
        const firstPage = pages[0];
        const igUrl = new URL(`https://graph.facebook.com/v18.0/${firstPage.id}`);
        igUrl.searchParams.set('fields', 'instagram_business_account');
        igUrl.searchParams.set('access_token', accessToken);
        
        const igResponse = await fetch(igUrl.toString());
        const igData = await igResponse.json() as any;
        
        if (igData.instagram_business_account) {
          // Get Instagram details
          const igDetailsUrl = new URL(`https://graph.facebook.com/v18.0/${igData.instagram_business_account.id}`);
          igDetailsUrl.searchParams.set('fields', 'username,name,profile_picture_url');
          igDetailsUrl.searchParams.set('access_token', accessToken);
          
          const igDetailsResponse = await fetch(igDetailsUrl.toString());
          const igDetails = await igDetailsResponse.json() as any;
          
          instagramAccount = {
            id: igData.instagram_business_account.id,
            username: igDetails.username,
            name: igDetails.name,
          };
        }
      }
      
      // Store in database
      await sql`
        INSERT INTO meta_accounts (
          team_id, 
          page_id, 
          page_name, 
          page_access_token,
          instagram_id,
          instagram_username,
          token_expires_at,
          created_at,
          updated_at
        ) VALUES (
          ${parseInt(teamId)},
          ${pages[0]?.id || null},
          ${pages[0]?.name || null},
          ${firstPage?.access_token || null},
          ${instagramAccount?.id || null},
          ${instagramAccount?.username || null},
          ${new Date(Date.now() + 60 * 60 * 1000).toISOString()}, -- 1 hour expiry (Meta short-lived tokens)
          NOW(),
          NOW()
        )
        ON CONFLICT (team_id) DO UPDATE SET
          page_id = EXCLUDED.page_id,
          page_name = EXCLUDED.page_name,
          page_access_token = EXCLUDED.page_access_token,
          instagram_id = EXCLUDED.instagram_id,
          instagram_username = EXCLUDED.instagram_username,
          token_expires_at = EXCLUDED.token_expires_at,
          updated_at = NOW()
      `;
      
      return reply.redirect('/settings?meta_connected=true');
    } catch (err: any) {
      console.error('Meta OAuth error:', err);
      return reply.redirect(`/settings?meta_error=${encodeURIComponent(err.message)}`);
    }
  });

  // Get connected Meta account for a team
  fastify.get('/api/meta/account/:team_id', {
    schema: {
      params: z.object({
        team_id: z.string(),
      }),
    },
  }, async (request, reply) => {
    const { team_id } = request.params as { team_id: string };
    
    const result = await sql`
      SELECT id, team_id, page_id, page_name, instagram_id, instagram_username, token_expires_at, created_at
      FROM meta_accounts
      WHERE team_id = ${parseInt(team_id)}
    `;
    
    if (result.length === 0) {
      return { connected: false };
    }
    
    const account = result[0];
    const tokenExpired = account.token_expires_at && new Date(account.token_expires_at) < new Date();
    
    return {
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
    };
  });

  // Disconnect Meta account
  fastify.post('/api/meta/disconnect', {
    schema: {
      body: z.object({
        team_id: z.string(),
      }),
    },
  }, async (request, reply) => {
    const { team_id } = request.body as { team_id: string };
    
    await sql`
      DELETE FROM meta_accounts
      WHERE team_id = ${parseInt(team_id)}
    `;
    
    return { success: true };
  });
}