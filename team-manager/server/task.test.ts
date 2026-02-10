import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  createTeam,
  createTask,
  getTaskById,
  updateTask,
  getTaskHistory,
  hasPermission,
  type TeamRole,
} from './db';
import { getDb } from './db';
import { users, teams, teamMembersCollaborative, tasks, activities } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

/**
 * Feature: collaborative-dev-platform
 * Property-based tests for task management system
 */

// Test data cleanup
async function cleanupTestData() {
  const db = await getDb();
  if (!db) return;

  try {
    await db.delete(activities);
    await db.delete(tasks);
    await db.delete(teamMembersCollaborative);
    await db.delete(teams);
    // Clean up test users by email pattern
    await db.delete(users).where(eq(users.email, 'creator@test.com'));
    await db.delete(users).where(eq(users.email, 'developer@test.com'));
    await db.delete(users).where(eq(users.email, 'viewer@test.com'));
    await db.delete(users).where(eq(users.email, 'assignee@test.com'));
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

// Helper to add user to team with specific role
async function addUserToTeam(teamId: number, userId: number, role: TeamRole): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  await db.insert(teamMembersCollaborative).values({
    teamId,
    userId,
    role,
    joinedAt: new Date(),
  });
}

describe('Task Management Property Tests', () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  /**
   * Property 10: Task Creation Authorization
   * Test that only users with Developer role or higher can create tasks
   * **Validates: Requirements 3.1**
   */
  it('Property 10: Only users with Developer role or higher can create tasks', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          role: fc.constantFrom('admin', 'team_lead', 'developer', 'viewer'),
          taskTitle: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          taskPriority: fc.constantFrom('low', 'medium', 'high', 'urgent'),
          taskStatus: fc.constantFrom('todo', 'in_progress', 'review', 'done'),
        }),
        async ({ role, taskTitle, taskPriority, taskStatus }) => {
          try {
            // Create admin user and team
            const adminId = await createTestUser('creator@test.com', 'Admin User');
            const team = await createTeam({ name: 'Test Team' }, adminId);

            // Create test user with specified role
            const testUserId = await createTestUser(`${role}@test.com`, `${role} User`);
            await addUserToTeam(team.id, testUserId, role as TeamRole);

            // Attempt to create task
            const canCreateTask = hasPermission(role as TeamRole, 'create_task');

            if (canCreateTask) {
              // Should succeed for admin, team_lead, developer
              const task = await createTask(
                {
                  teamId: team.id,
                  title: taskTitle,
                  description: 'Test task',
                  priority: taskPriority,
                  status: taskStatus,
                },
                testUserId
              );

              expect(task).toBeDefined();
              expect(task.title).toBe(taskTitle);
              expect(task.teamId).toBe(team.id);
            } else {
              // Should fail for viewer
              await expect(
                createTask(
                  {
                    teamId: team.id,
                    title: taskTitle,
                    description: 'Test task',
                    priority: taskPriority,
                    status: taskStatus,
                  },
                  testUserId
                )
              ).rejects.toThrow();
            }

            // Cleanup
            await cleanupTestData();
          } catch (error) {
            await cleanupTestData();
            throw error;
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 12: Task History Preservation
   * Test that task modifications maintain complete history
   * **Validates: Requirements 3.5**
   */
  it('Property 12: Task modifications maintain complete history', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          initialTitle: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          updatedTitle: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          initialPriority: fc.constantFrom('low', 'medium', 'high', 'urgent'),
          updatedPriority: fc.constantFrom('low', 'medium', 'high', 'urgent'),
        }),
        async ({ initialTitle, updatedTitle, initialPriority, updatedPriority }) => {
          try {
            // Create admin user and team
            const adminId = await createTestUser('creator@test.com', 'Admin User');
            const team = await createTeam({ name: 'Test Team' }, adminId);

            // Create task
            const task = await createTask(
              {
                teamId: team.id,
                title: initialTitle,
                description: 'Initial description',
                priority: initialPriority,
                status: 'todo',
              },
              adminId
            );

            // Get initial history
            const historyAfterCreate = await getTaskHistory(task.id);
            expect(historyAfterCreate.length).toBeGreaterThanOrEqual(1);
            
            // Verify creation activity exists
            const createActivity = historyAfterCreate.find(h => h.type === 'task_created');
            expect(createActivity).toBeDefined();

            // Update task
            await updateTask(
              task.id,
              {
                title: updatedTitle,
                priority: updatedPriority,
              },
              adminId
            );

            // Get updated history
            const historyAfterUpdate = await getTaskHistory(task.id);
            
            // History should have grown
            expect(historyAfterUpdate.length).toBeGreaterThan(historyAfterCreate.length);
            
            // Verify update activity exists
            const updateActivity = historyAfterUpdate.find(h => h.type === 'task_updated');
            expect(updateActivity).toBeDefined();
            
            // Verify metadata contains change information
            if (updateActivity?.metadata) {
              const metadata = JSON.parse(updateActivity.metadata);
              expect(metadata.changedFields).toBeDefined();
              expect(metadata.previousValues).toBeDefined();
              expect(metadata.newValues).toBeDefined();
            }

            // Cleanup
            await cleanupTestData();
          } catch (error) {
            await cleanupTestData();
            throw error;
          }
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property 13: Task Assignment Notification
   * Test that assignees receive notifications when tasks are assigned
   * **Validates: Requirements 3.6**
   */
  it('Property 13: Task assignment creates activity notification', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          taskTitle: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          taskPriority: fc.constantFrom('low', 'medium', 'high', 'urgent'),
        }),
        async ({ taskTitle, taskPriority }) => {
          try {
            // Create admin user and team
            const adminId = await createTestUser('creator@test.com', 'Admin User');
            const team = await createTeam({ name: 'Test Team' }, adminId);

            // Create assignee user
            const assigneeId = await createTestUser('assignee@test.com', 'Assignee User');
            await addUserToTeam(team.id, assigneeId, 'developer');

            // Create task without assignee
            const task = await createTask(
              {
                teamId: team.id,
                title: taskTitle,
                description: 'Test task',
                priority: taskPriority,
                status: 'todo',
              },
              adminId
            );

            // Update task to assign it
            await updateTask(
              task.id,
              {
                assigneeId: assigneeId,
              },
              adminId
            );

            // Get task history
            const history = await getTaskHistory(task.id);
            
            // Verify update activity exists
            const updateActivity = history.find(h => h.type === 'task_updated');
            expect(updateActivity).toBeDefined();
            
            // Verify metadata contains assignee change
            if (updateActivity?.metadata) {
              const metadata = JSON.parse(updateActivity.metadata);
              expect(metadata.changedFields).toContain('assignee');
              expect(metadata.newValues.assigneeId).toBe(assigneeId);
            }

            // Verify the task has the assignee
            const updatedTask = await getTaskById(task.id);
            expect(updatedTask?.assigneeId).toBe(assigneeId);

            // Cleanup
            await cleanupTestData();
          } catch (error) {
            await cleanupTestData();
            throw error;
          }
        }
      ),
      { numRuns: 5 }
    );
  });
});
