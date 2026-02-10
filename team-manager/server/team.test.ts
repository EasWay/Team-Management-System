import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  createTeam,
  getUserTeams,
  getTeamById,
  updateTeam,
  deleteTeam,
  getCollaborativeTeamMembers,
  createTeamInvitation,
  acceptTeamInvitation,
  changeTeamMemberRole,
  removeTeamMember,
  checkTeamPermission,
  hasPermission,
  type TeamRole,
} from './db';
import { getDb } from './db';
import { users, teams, teamMembersCollaborative, teamInvitations } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

/**
 * Feature: collaborative-dev-platform
 * Property-based tests for team collaboration system
 */

// Test data cleanup
async function cleanupTestData() {
  const db = await getDb();
  if (!db) return;

  try {
    await db.delete(teamInvitations);
    await db.delete(teamMembersCollaborative);
    await db.delete(teams);
    // Clean up test users by email pattern
    await db.delete(users).where(eq(users.email, 'test@example.com'));
    await db.delete(users).where(eq(users.email, 'test2@example.com'));
    await db.delete(users).where(eq(users.email, 'test3@example.com'));
    await db.delete(users).where(eq(users.email, 'admin@test.com'));
    await db.delete(users).where(eq(users.email, 'invitee@test.com'));
    await db.delete(users).where(eq(users.email, 'member@test.com'));
    await db.delete(users).where(eq(users.email, 'admin@example.com'));
    await db.delete(users).where(eq(users.email, 'developer@example.com'));
    await db.delete(users).where(eq(users.email, 'user@example.com'));
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

// Helper to create test user
async function createTestUser(email: string, name: string): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Generate unique openId based on email and timestamp
  const openId = `test-${email}-${Date.now()}-${Math.random()}`;

  const [user] = await db
    .insert(users)
    .values({
      email,
      name,
      openId,
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    })
    .returning();

  return user.id;
}

describe('Team Collaboration Property Tests', () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  /**
   * Property 5: Team Creation Admin Assignment
   * Test that team creators are automatically assigned admin role
   * **Validates: Requirements 2.1**
   */
  it('Property 5: Team creators are automatically assigned admin role', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          teamName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          teamDescription: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
          userName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          userEmail: fc.emailAddress(),
        }),
        async ({ teamName, teamDescription, userName, userEmail }) => {
          try {
            // Create a test user
            const userId = await createTestUser(userEmail, userName);

            // Create a team
            const team = await createTeam(
              {
                name: teamName,
                description: teamDescription,
              },
              userId
            );

            // Verify team was created
            expect(team).toBeDefined();
            expect(team.name).toBe(teamName);
            expect(team.ownerId).toBe(userId);

            // Verify creator has admin role
            expect(team.memberRole).toBe('admin');

            // Verify in database
            const members = await getCollaborativeTeamMembers(team.id);
            const creatorMembership = members.find((m) => m.userId === userId);

            // Debug logging if member not found
            if (!creatorMembership) {
              console.error('Members found:', members);
              console.error('Looking for userId:', userId);
              console.error('Team ID:', team.id);
            }

            expect(creatorMembership).toBeDefined();
            expect(creatorMembership?.role).toBe('admin');

            // Cleanup
            await cleanupTestData();
          } catch (error) {
            // Cleanup on error
            await cleanupTestData();
            throw error;
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 6: Role-Based Access Control
   * Test that permissions are enforced based on user roles
   * **Validates: Requirements 2.6**
   */
  it('Property 6: Permissions are enforced based on user roles', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          role: fc.constantFrom('admin', 'team_lead', 'developer', 'viewer'),
          permission: fc.constantFrom(
            'create_team',
            'delete_team',
            'update_team',
            'invite_member',
            'remove_member',
            'change_role',
            'create_task',
            'update_task',
            'delete_task'
          ),
        }),
        async ({ role, permission }) => {
          // Test the permission function
          const hasAccess = hasPermission(role as TeamRole, permission);

          // Verify permission logic
          if (role === 'admin') {
            // Admin should have all permissions
            expect(hasAccess).toBe(true);
          } else if (role === 'team_lead') {
            // Team lead should have specific permissions
            const teamLeadPermissions = [
              'update_team',
              'invite_member',
              'create_task',
              'update_task',
              'delete_task',
            ];
            expect(hasAccess).toBe(teamLeadPermissions.includes(permission));
          } else if (role === 'developer') {
            // Developer should have limited permissions
            const developerPermissions = ['create_task', 'update_task'];
            expect(hasAccess).toBe(developerPermissions.includes(permission));
          } else if (role === 'viewer') {
            // Viewer should have no permissions
            expect(hasAccess).toBe(false);
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 6 (Integration): Role-based access control in team operations
   * Test that team operations enforce role-based permissions
   */
  it('Property 6 (Integration): Team operations enforce role-based permissions', async () => {
    // Create test users
    const adminId = await createTestUser('admin@example.com', 'Admin User');
    const developerId = await createTestUser('developer@example.com', 'Developer User');

    // Admin creates a team
    const team = await createTeam(
      {
        name: 'Test Team',
        description: 'Test Description',
      },
      adminId
    );

    // Add developer to team
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    await db.insert(teamMembersCollaborative).values({
      teamId: team.id,
      userId: developerId,
      role: 'developer',
    });

    // Test: Developer should NOT be able to update team
    await expect(
      updateTeam(team.id, { name: 'Updated Name' }, developerId)
    ).rejects.toThrow('Insufficient permissions');

    // Test: Admin should be able to update team
    const updated = await updateTeam(team.id, { name: 'Updated Name' }, adminId);
    expect(updated?.name).toBe('Updated Name');

    // Test: Developer should NOT be able to delete team
    await expect(deleteTeam(team.id, developerId)).rejects.toThrow(
      'Insufficient permissions'
    );

    // Test: Admin should be able to delete team
    const deleted = await deleteTeam(team.id, adminId);
    expect(deleted).toBe(true);

    await cleanupTestData();
  });

  /**
   * Additional test: Verify team retrieval works correctly
   */
  it('should retrieve teams for a user', async () => {
    const userId = await createTestUser('user@example.com', 'Test User');

    // Create multiple teams
    const team1 = await createTeam({ name: 'Team 1' }, userId);
    const team2 = await createTeam({ name: 'Team 2' }, userId);

    // Retrieve teams
    const userTeams = await getUserTeams(userId);

    expect(userTeams).toHaveLength(2);
    expect(userTeams.map((t) => t.name)).toContain('Team 1');
    expect(userTeams.map((t) => t.name)).toContain('Team 2');
    expect(userTeams.every((t) => t.memberRole === 'admin')).toBe(true);

    await cleanupTestData();
  });

  /**
   * Additional test: Verify team retrieval by ID
   */
  it('should retrieve team by ID with role information', async () => {
    const userId = await createTestUser('user@example.com', 'Test User');
    const team = await createTeam({ name: 'Test Team' }, userId);

    const retrieved = await getTeamById(team.id, userId);

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(team.id);
    expect(retrieved?.name).toBe('Test Team');
    expect(retrieved?.memberRole).toBe('admin');

    await cleanupTestData();
  });
});


describe('Team Workflow Property Tests', () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  /**
   * Property 7: Team Invitation Workflow
   * Test invitation creation, acceptance, and role assignment
   * **Validates: Requirements 2.2, 2.3**
   */
  it('Property 7: Team invitation workflow completes successfully', async () => {
    const adminId = await createTestUser('admin@test.com', 'Admin User');
    const inviteeId = await createTestUser('invitee@test.com', 'Invitee User');

    // Admin creates a team
    const team = await createTeam({ name: 'Test Team' }, adminId);

    // Admin creates invitation
    const invitation = await createTeamInvitation({
      teamId: team.id,
      email: 'invitee@test.com',
      role: 'developer',
      invitedBy: adminId,
    });

    expect(invitation).toBeDefined();
    expect(invitation.email).toBe('invitee@test.com');
    expect(invitation.role).toBe('developer');

    // Invitee accepts invitation
    const membership = await acceptTeamInvitation(invitation.token, inviteeId);

    expect(membership).toBeDefined();
    expect(membership.teamId).toBe(team.id);
    expect(membership.userId).toBe(inviteeId);
    expect(membership.role).toBe('developer');

    await cleanupTestData();
  });

  /**
   * Property 8: Role Change Immediate Effect
   * Test that role changes update permissions immediately
   * **Validates: Requirements 2.4**
   */
  it('Property 8: Role changes take immediate effect', async () => {
    const adminId = await createTestUser('admin@test.com', 'Admin User');
    const memberId = await createTestUser('member@test.com', 'Member User');

    // Create team and add member
    const team = await createTeam({ name: 'Test Team' }, adminId);
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    await db.insert(teamMembersCollaborative).values({
      teamId: team.id,
      userId: memberId,
      role: 'viewer',
    });

    // Verify initial role
    let hasPermission = await checkTeamPermission(team.id, memberId, 'create_task');
    expect(hasPermission).toBe(false);

    // Change role to developer
    await changeTeamMemberRole(team.id, memberId, 'developer', adminId);

    // Verify permission changed immediately
    hasPermission = await checkTeamPermission(team.id, memberId, 'create_task');
    expect(hasPermission).toBe(true);

    await cleanupTestData();
  });

  /**
   * Property 9: Member Removal Access Revocation
   * Test that removed members lose access to team resources
   * **Validates: Requirements 2.5**
   */
  it('Property 9: Removed members lose access immediately', async () => {
    const adminId = await createTestUser('admin@test.com', 'Admin User');
    const memberId = await createTestUser('member@test.com', 'Member User');

    // Create team and add member
    const team = await createTeam({ name: 'Test Team' }, adminId);
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    await db.insert(teamMembersCollaborative).values({
      teamId: team.id,
      userId: memberId,
      role: 'developer',
    });

    // Verify member has access
    let hasPermission = await checkTeamPermission(team.id, memberId, 'create_task');
    expect(hasPermission).toBe(true);

    // Remove member
    await removeTeamMember(team.id, memberId, adminId);

    // Verify member lost access
    hasPermission = await checkTeamPermission(team.id, memberId, 'create_task');
    expect(hasPermission).toBe(false);

    await cleanupTestData();
  });
});
