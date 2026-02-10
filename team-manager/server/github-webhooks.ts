import { Request, Response } from 'express';
import express from 'express';
import { Webhooks, createNodeMiddleware } from '@octokit/webhooks';
import { getDb } from './db';
import { repositories, activities } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * Verify GitHub webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

/**
 * Process GitHub push event (commits)
 */
async function handlePushEvent(payload: any, repositoryId: number, teamId: number) {
  const db = await getDb();
  if (!db) {
    console.error('[Webhook] Database not available');
    return;
  }

  const commits = payload.commits || [];
  const pusher = payload.pusher?.name || 'Unknown';
  const ref = payload.ref || '';
  const branch = ref.replace('refs/heads/', '');

  // Create activity for the push event
  try {
    await db.insert(activities).values({
      teamId,
      userId: 1, // System user for webhook events
      type: 'commit_pushed',
      entityId: repositoryId.toString(),
      entityType: 'repository',
      metadata: JSON.stringify({
        repositoryName: payload.repository?.full_name,
        branch,
        pusher,
        commitCount: commits.length,
        commits: commits.slice(0, 5).map((commit: any) => ({
          sha: commit.id,
          message: commit.message,
          author: commit.author?.name,
          url: commit.url,
        })),
      }),
    });

    console.log(`[Webhook] Processed push event: ${commits.length} commits to ${branch}`);
  } catch (error) {
    console.error('[Webhook] Failed to create push activity:', error);
  }
}

/**
 * Process GitHub pull_request event
 */
async function handlePullRequestEvent(payload: any, repositoryId: number, teamId: number) {
  const db = await getDb();
  if (!db) {
    console.error('[Webhook] Database not available');
    return;
  }

  const action = payload.action;
  const pr = payload.pull_request;

  if (!pr) {
    console.error('[Webhook] No pull request data in payload');
    return;
  }

  const activityType = `pr_${action}` as const;

  // Create activity for the PR event
  try {
    await db.insert(activities).values({
      teamId,
      userId: 1, // System user for webhook events
      type: activityType,
      entityId: repositoryId.toString(),
      entityType: 'repository',
      metadata: JSON.stringify({
        repositoryName: payload.repository?.full_name,
        prNumber: pr.number,
        prTitle: pr.title,
        prUrl: pr.html_url,
        prState: pr.state,
        prAuthor: pr.user?.login,
        action,
        merged: pr.merged || false,
        baseBranch: pr.base?.ref,
        headBranch: pr.head?.ref,
      }),
    });

    console.log(`[Webhook] Processed PR event: ${action} #${pr.number}`);
  } catch (error) {
    console.error('[Webhook] Failed to create PR activity:', error);
  }
}

/**
 * Process GitHub issues event
 */
async function handleIssuesEvent(payload: any, repositoryId: number, teamId: number) {
  const db = await getDb();
  if (!db) {
    console.error('[Webhook] Database not available');
    return;
  }

  const action = payload.action;
  const issue = payload.issue;

  if (!issue) {
    console.error('[Webhook] No issue data in payload');
    return;
  }

  const activityType = `issue_${action}` as const;

  // Create activity for the issue event
  try {
    await db.insert(activities).values({
      teamId,
      userId: 1, // System user for webhook events
      type: activityType,
      entityId: repositoryId.toString(),
      entityType: 'repository',
      metadata: JSON.stringify({
        repositoryName: payload.repository?.full_name,
        issueNumber: issue.number,
        issueTitle: issue.title,
        issueUrl: issue.html_url,
        issueState: issue.state,
        issueAuthor: issue.user?.login,
        action,
        labels: issue.labels?.map((label: any) => label.name) || [],
      }),
    });

    console.log(`[Webhook] Processed issue event: ${action} #${issue.number}`);
  } catch (error) {
    console.error('[Webhook] Failed to create issue activity:', error);
  }
}

/**
 * GitHub webhook handler endpoint
 */
export async function handleGitHubWebhook(req: Request, res: Response) {
  try {
    const signature = req.headers['x-hub-signature-256'] as string;
    const event = req.headers['x-github-event'] as string;
    const payload = req.body;

    if (!signature || !event) {
      console.error('[Webhook] Missing signature or event header');
      return res.status(400).json({ error: 'Missing required headers' });
    }

    // Get repository from database to verify signature
    const db = await getDb();
    if (!db) {
      console.error('[Webhook] Database not available');
      return res.status(500).json({ error: 'Database not available' });
    }

    // Find repository by GitHub ID
    const githubRepoId = payload.repository?.id;
    if (!githubRepoId) {
      console.error('[Webhook] No repository ID in payload');
      return res.status(400).json({ error: 'Invalid payload' });
    }

    const [repository] = await db
      .select()
      .from(repositories)
      .where(eq(repositories.githubId, githubRepoId))
      .limit(1);

    if (!repository) {
      console.error('[Webhook] Repository not found:', githubRepoId);
      return res.status(404).json({ error: 'Repository not found' });
    }

    // Verify webhook signature
    const payloadString = JSON.stringify(payload);
    const isValid = verifyWebhookSignature(
      payloadString,
      signature,
      repository.webhookSecret
    );

    if (!isValid) {
      console.error('[Webhook] Invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Process event based on type
    switch (event) {
      case 'push':
        await handlePushEvent(payload, repository.id, repository.teamId);
        break;
      case 'pull_request':
        await handlePullRequestEvent(payload, repository.id, repository.teamId);
        break;
      case 'issues':
        await handleIssuesEvent(payload, repository.id, repository.teamId);
        break;
      default:
        console.log(`[Webhook] Unhandled event type: ${event}`);
    }

    // Update repository lastSyncAt
    await db
      .update(repositories)
      .set({ lastSyncAt: new Date() })
      .where(eq(repositories.id, repository.id));

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Webhook] Error processing webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Register webhook endpoint with Express
 */
export function registerWebhookEndpoint(app: any) {
  // Use raw body parser for webhook signature verification
  app.post(
    '/api/github/webhook',
    express.raw({ type: 'application/json' }),
    async (req: Request, res: Response) => {
      // Convert raw body to JSON
      try {
        req.body = JSON.parse(req.body.toString());
        await handleGitHubWebhook(req, res);
      } catch (error) {
        console.error('[Webhook] Failed to parse webhook payload:', error);
        res.status(400).json({ error: 'Invalid JSON payload' });
      }
    }
  );

  console.log('[Webhook] GitHub webhook endpoint registered at /api/github/webhook');
}
