import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { appRouter } from './routers';
import { getDb, createTeam, createUserWithPassword } from './db';
import { users, teamMembersCollaborative, clients } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import type { TrpcContext } from './_core/context';

/**
 * Phase A authorization fixes: privilege escalation + cross-tenant data leaks.
 * See /root/.claude/plans/analyze-the-test-coverage-drifting-pillow.md for the
 * full audit this covers.
 */

function ctxFor(user: any): TrpcContext {
  return { user, req: {} as any, res: {} as any };
}

async function createTestUser(email: string, role: 'user' | 'admin' = 'user') {
  const user = await createUserWithPassword({ email, passwordHash: 'x', name: email.split('@')[0] });
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  if (user.role !== role) {
    await db.update(users).set({ role }).where(eq(users.id, user.id));
  }
  return { ...user, role };
}

async function addMember(teamId: number, memberId: number, role: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.insert(teamMembersCollaborative).values({ teamId, memberId, role, status: 'active' });
}

async function cleanup() {
  const db = await getDb();
  if (!db) return;
  await db.delete(clients).where(eq(clients.email, 'client-authz-test@example.com'));
  for (const email of [
    'authz-a-admin@test.com', 'authz-a-viewer@test.com', 'authz-b-admin@test.com',
    'authz-platform-admin@test.com', 'authz-self@test.com', 'authz-other@test.com',
  ]) {
    await db.delete(users).where(eq(users.email, email));
  }
}

describe('Phase A: Critical authorization fixes', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  describe('security.permissions.grant / roles.create / roles.assign', () => {
    it('rejects a caller from a different team', async () => {
      const teamAAdmin = await createTestUser('authz-a-admin@test.com');
      const teamBAdmin = await createTestUser('authz-b-admin@test.com');
      const teamA = await createTeam({ name: 'Team A' }, teamAAdmin.id);
      await createTeam({ name: 'Team B' }, teamBAdmin.id);

      const callerB = appRouter.createCaller(ctxFor(teamBAdmin));
      await expect(
        callerB.security.permissions.grant({
          teamId: teamA.id,
          userId: teamBAdmin.id,
          resourceType: 'task',
          resourceId: 1,
          permission: 'admin',
        })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('rejects a low-privilege member of the correct team', async () => {
      const teamAAdmin = await createTestUser('authz-a-admin@test.com');
      const viewer = await createTestUser('authz-a-viewer@test.com');
      const teamA = await createTeam({ name: 'Team A' }, teamAAdmin.id);
      await addMember(teamA.id, viewer.id, 'viewer');

      const callerViewer = appRouter.createCaller(ctxFor(viewer));
      await expect(
        callerViewer.security.roles.create({
          teamId: teamA.id,
          name: 'Custom Role',
          permissions: ['read'],
        })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });

      await expect(
        callerViewer.security.roles.assign({
          teamId: teamA.id,
          userId: viewer.id,
          roleId: 1,
        })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('allows the team admin to grant permissions on their own team', async () => {
      const teamAAdmin = await createTestUser('authz-a-admin@test.com');
      const teamA = await createTeam({ name: 'Team A' }, teamAAdmin.id);

      const callerAdmin = appRouter.createCaller(ctxFor(teamAAdmin));
      await expect(
        callerAdmin.security.permissions.grant({
          teamId: teamA.id,
          userId: teamAAdmin.id,
          resourceType: 'task',
          resourceId: 1,
          permission: 'admin',
        })
      ).resolves.toBeDefined();
    });
  });

  describe('security.audit.getTrail', () => {
    it('rejects a non-admin caller who omits teamId', async () => {
      const teamAAdmin = await createTestUser('authz-a-admin@test.com');
      await createTeam({ name: 'Team A' }, teamAAdmin.id);

      const caller = appRouter.createCaller(ctxFor(teamAAdmin));
      await expect(caller.security.audit.getTrail({})).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('rejects a caller with no membership in the requested teamId', async () => {
      const teamAAdmin = await createTestUser('authz-a-admin@test.com');
      const teamBAdmin = await createTestUser('authz-b-admin@test.com');
      const teamA = await createTeam({ name: 'Team A' }, teamAAdmin.id);
      await createTeam({ name: 'Team B' }, teamBAdmin.id);

      const callerB = appRouter.createCaller(ctxFor(teamBAdmin));
      await expect(callerB.security.audit.getTrail({ teamId: teamA.id })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('allows a platform admin to omit teamId (cross-team visibility)', async () => {
      const platformAdmin = await createTestUser('authz-platform-admin@test.com', 'admin');
      const caller = appRouter.createCaller(ctxFor(platformAdmin));
      await expect(caller.security.audit.getTrail({})).resolves.toBeDefined();
    });

    it('allows a team admin to view their own team audit trail', async () => {
      const teamAAdmin = await createTestUser('authz-a-admin@test.com');
      const teamA = await createTeam({ name: 'Team A' }, teamAAdmin.id);
      const caller = appRouter.createCaller(ctxFor(teamAAdmin));
      await expect(caller.security.audit.getTrail({ teamId: teamA.id })).resolves.toBeDefined();
    });
  });

  describe('security.sessions.list / security.twoFactor.enable', () => {
    it('rejects a user managing another user\'s sessions/2FA', async () => {
      const self = await createTestUser('authz-self@test.com');
      const other = await createTestUser('authz-other@test.com');

      const callerSelf = appRouter.createCaller(ctxFor(self));
      await expect(callerSelf.security.sessions.list({ userId: other.id })).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(callerSelf.security.twoFactor.enable({ userId: other.id, method: 'totp' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('allows a user to manage their own sessions/2FA', async () => {
      const self = await createTestUser('authz-self@test.com');
      const callerSelf = appRouter.createCaller(ctxFor(self));
      await expect(callerSelf.security.sessions.list({ userId: self.id })).resolves.toBeDefined();
      await expect(callerSelf.security.twoFactor.enable({ userId: self.id, method: 'totp' })).resolves.toBeDefined();
    });

    it('allows a platform admin to manage another user\'s sessions', async () => {
      const platformAdmin = await createTestUser('authz-platform-admin@test.com', 'admin');
      const other = await createTestUser('authz-other@test.com');
      const callerAdmin = appRouter.createCaller(ctxFor(platformAdmin));
      await expect(callerAdmin.security.sessions.list({ userId: other.id })).resolves.toBeDefined();
    });
  });

  describe('clientPortalAdmin.getTeamFeedback / getStatistics / createAccess', () => {
    it('rejects a caller from a different team', async () => {
      const teamAAdmin = await createTestUser('authz-a-admin@test.com');
      const teamBAdmin = await createTestUser('authz-b-admin@test.com');
      const teamA = await createTeam({ name: 'Team A' }, teamAAdmin.id);
      await createTeam({ name: 'Team B' }, teamBAdmin.id);

      const callerB = appRouter.createCaller(ctxFor(teamBAdmin));
      await expect(callerB.clientPortalAdmin.getTeamFeedback({ teamId: teamA.id })).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(callerB.clientPortalAdmin.getStatistics({ teamId: teamA.id })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('allows a member of the correct team', async () => {
      const teamAAdmin = await createTestUser('authz-a-admin@test.com');
      const teamA = await createTeam({ name: 'Team A' }, teamAAdmin.id);
      const caller = appRouter.createCaller(ctxFor(teamAAdmin));
      await expect(caller.clientPortalAdmin.getTeamFeedback({ teamId: teamA.id })).resolves.toBeDefined();
      await expect(caller.clientPortalAdmin.getStatistics({ teamId: teamA.id })).resolves.toBeDefined();
    });

    it('rejects creating client portal access when the client belongs to a different team', async () => {
      const teamAAdmin = await createTestUser('authz-a-admin@test.com');
      const teamBAdmin = await createTestUser('authz-b-admin@test.com');
      const teamA = await createTeam({ name: 'Team A' }, teamAAdmin.id);
      const teamB = await createTeam({ name: 'Team B' }, teamBAdmin.id);

      const db = await getDb();
      if (!db) throw new Error('Database not available');
      const [clientOfB] = await db.insert(clients).values({
        teamId: teamB.id,
        firstName: 'Test',
        lastName: 'Client',
        email: 'client-authz-test@example.com',
      }).returning();

      // Team A's admin tries to create portal access for Team B's client, claiming teamId = A
      const callerA = appRouter.createCaller(ctxFor(teamAAdmin));
      await expect(
        callerA.clientPortalAdmin.createAccess({
          clientId: clientOfB.id,
          teamId: teamA.id,
          email: 'client-authz-test@example.com',
          password: 'password123',
        })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
  });
});
