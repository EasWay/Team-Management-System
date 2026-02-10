import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import {
  createTeam,
  createTask,
  updateTask,
  deleteTask,
  moveTask,
  getDb,
} from './db';
import { users, teams, teamMembersCollaborative, tasks, activities } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import * as socketServer from './socket-server';

/**
 * Feature: collaborative-dev-platform
 * Property-based tests for real-time synchronization
 */

// Mock socket server functions
vi.mock('./socket-server', async () => {
  const actual = await vi.importActual('./socket-server');
  return {
    ...actual,
    broadcastTaskCreated: vi.fn(),
    broadcastTaskUpdated: vi.fn(),
    broadcastTaskMoved: vi.fn(),
    broadcastTaskDeleted: vi.fn(),
  };
});

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
    await db.delete(users).where(eq(users.email, 'admin@realtime.test'));
    await db.delete(users).where(eq(users.email, 'member1@realtime.test'));
    await db.delete(users).where(eq(users.email, 'member2@realtime.test'));
    await db.delete(users).where(eq(users.email, 'member3@realtime.test'));
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
async function addUserToTeam(teamId: number, userId: number, role: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  await db.insert(teamMembersCollaborative).values({
    teamId,
    userId,
    role,
    joinedAt: new Date(),
  });
}

describe('Real-time Synchronization Property Tests', () => {
  let adminId: number;
  let team: any;

  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();
    
    // Create shared test data once per test
    adminId = await createTestUser('admin@realtime.test', 'Admin User');
    team = await createTeam({ name: 'Real-time Test Team' }, adminId);
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  /**
   * Property 11: Real-time Task Synchronization
   * Test that task updates are broadcast to all team members in real-time
   * **Validates: Requirements 3.2, 3.3, 3.4**
   */
  it('Property 11: Task updates are broadcast to all team members in real-time', async () => {
    // Create team members once for all iterations
    const member1Id = await createTestUser('member1@realtime.test', 'Member 1');
    const member2Id = await createTestUser('member2@realtime.test', 'Member 2');
    const member3Id = await createTestUser('member3@realtime.test', 'Member 3');

    await addUserToTeam(team.id, member1Id, 'developer');
    await addUserToTeam(team.id, member2Id, 'developer');
    await addUserToTeam(team.id, member3Id, 'viewer');

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          taskTitle: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          updatedTitle: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          taskPriority: fc.constantFrom('low', 'medium', 'high', 'urgent'),
          updatedPriority: fc.constantFrom('low', 'medium', 'high', 'urgent'),
          taskStatus: fc.constantFrom('todo', 'in_progress', 'review', 'done'),
          updatedStatus: fc.constantFrom('todo', 'in_progress', 'review', 'done'),
          operationType: fc.constantFrom('create', 'update', 'move', 'delete'),
        }),
        async ({ taskTitle, updatedTitle, taskPriority, updatedPriority, taskStatus, updatedStatus, operationType }) => {
          vi.clearAllMocks();

          // Test different operation types
          if (operationType === 'create') {
            // Test task creation broadcasts
            const task = await createTask(
              {
                teamId: team.id,
                title: taskTitle,
                description: 'Test task for real-time sync',
                priority: taskPriority,
                status: taskStatus,
              },
              adminId
            );

            // Verify broadcastTaskCreated was called
            expect(socketServer.broadcastTaskCreated).toHaveBeenCalledTimes(1);
            expect(socketServer.broadcastTaskCreated).toHaveBeenCalledWith(team.id, task);

            // Verify the broadcast includes correct task data
            const broadcastCall = vi.mocked(socketServer.broadcastTaskCreated).mock.calls[0];
            expect(broadcastCall[0]).toBe(team.id);
            expect(broadcastCall[1]).toMatchObject({
              id: task.id,
              title: taskTitle,
              teamId: team.id,
              priority: taskPriority,
              status: taskStatus,
            });

          } else if (operationType === 'update') {
            // Create a task first
            const task = await createTask(
              {
                teamId: team.id,
                title: taskTitle,
                description: 'Test task',
                priority: taskPriority,
                status: taskStatus,
              },
              adminId
            );

            // Clear create broadcast
            vi.clearAllMocks();

            // Test task update broadcasts
            const updatedTask = await updateTask(
              task.id,
              {
                title: updatedTitle,
                priority: updatedPriority,
              },
              adminId
            );

            // Verify broadcastTaskUpdated was called
            expect(socketServer.broadcastTaskUpdated).toHaveBeenCalledTimes(1);
            expect(socketServer.broadcastTaskUpdated).toHaveBeenCalledWith(team.id, updatedTask);

            // Verify the broadcast includes updated data
            const broadcastCall = vi.mocked(socketServer.broadcastTaskUpdated).mock.calls[0];
            expect(broadcastCall[0]).toBe(team.id);
            expect(broadcastCall[1]).toMatchObject({
              id: task.id,
              title: updatedTitle,
              priority: updatedPriority,
            });

          } else if (operationType === 'move') {
            // Create a task first
            const task = await createTask(
              {
                teamId: team.id,
                title: taskTitle,
                description: 'Test task',
                priority: taskPriority,
                status: taskStatus,
              },
              adminId
            );

            // Clear create broadcast
            vi.clearAllMocks();

            // Test task move broadcasts
            const movedTask = await moveTask(task.id, updatedStatus, 0, adminId);

            // Verify broadcastTaskMoved was called
            expect(socketServer.broadcastTaskMoved).toHaveBeenCalledTimes(1);
            expect(socketServer.broadcastTaskMoved).toHaveBeenCalledWith(
              team.id,
              task.id,
              updatedStatus,
              0
            );

            // Verify the broadcast includes correct movement data
            const broadcastCall = vi.mocked(socketServer.broadcastTaskMoved).mock.calls[0];
            expect(broadcastCall[0]).toBe(team.id);
            expect(broadcastCall[1]).toBe(task.id);
            expect(broadcastCall[2]).toBe(updatedStatus);

          } else if (operationType === 'delete') {
            // Create a task first
            const task = await createTask(
              {
                teamId: team.id,
                title: taskTitle,
                description: 'Test task',
                priority: taskPriority,
                status: taskStatus,
              },
              adminId
            );

            // Clear create broadcast
            vi.clearAllMocks();

            // Test task delete broadcasts
            await deleteTask(task.id, adminId);

            // Verify broadcastTaskDeleted was called
            expect(socketServer.broadcastTaskDeleted).toHaveBeenCalledTimes(1);
            expect(socketServer.broadcastTaskDeleted).toHaveBeenCalledWith(team.id, task.id);

            // Verify the broadcast includes correct deletion data
            const broadcastCall = vi.mocked(socketServer.broadcastTaskDeleted).mock.calls[0];
            expect(broadcastCall[0]).toBe(team.id);
            expect(broadcastCall[1]).toBe(task.id);
          }
        }
      ),
      { numRuns: 100 } // 100+ iterations as required
    );
  });

  /**
   * Additional test: Verify broadcast happens for all team members regardless of role
   */
  it('should broadcast task updates to all team members regardless of role', async () => {
    // Create members with different roles
    const developerId = await createTestUser('member1@realtime.test', 'Developer');
    const viewerId = await createTestUser('member2@realtime.test', 'Viewer');
    const teamLeadId = await createTestUser('member3@realtime.test', 'Team Lead');

    await addUserToTeam(team.id, developerId, 'developer');
    await addUserToTeam(team.id, viewerId, 'viewer');
    await addUserToTeam(team.id, teamLeadId, 'team_lead');

    vi.clearAllMocks();

    // Create a task
    const task = await createTask(
      {
        teamId: team.id,
        title: 'Broadcast Test Task',
        description: 'Testing broadcast to all roles',
        priority: 'medium',
        status: 'todo',
      },
      adminId
    );

    // Verify broadcast was called once (to the team room, not per member)
    expect(socketServer.broadcastTaskCreated).toHaveBeenCalledTimes(1);
    expect(socketServer.broadcastTaskCreated).toHaveBeenCalledWith(team.id, task);

    // The broadcast goes to the team room, which all members should be subscribed to
    // This ensures all members (admin, developer, viewer, team_lead) receive the update
    const broadcastCall = vi.mocked(socketServer.broadcastTaskCreated).mock.calls[0];
    expect(broadcastCall[0]).toBe(team.id);
  });

  /**
   * Additional test: Verify multiple rapid updates all broadcast correctly
   */
  it('should broadcast multiple rapid task updates in sequence', async () => {
    // Create a task
    const task = await createTask(
      {
        teamId: team.id,
        title: 'Initial Title',
        description: 'Initial description',
        priority: 'low',
        status: 'todo',
      },
      adminId
    );

    vi.clearAllMocks();

    // Perform multiple rapid updates
    await updateTask(task.id, { title: 'Updated Title 1' }, adminId);
    await updateTask(task.id, { priority: 'medium' }, adminId);
    await updateTask(task.id, { title: 'Updated Title 2', priority: 'high' }, adminId);

    // Verify all updates were broadcast
    expect(socketServer.broadcastTaskUpdated).toHaveBeenCalledTimes(3);

    // Verify each broadcast had correct team ID
    const calls = vi.mocked(socketServer.broadcastTaskUpdated).mock.calls;
    expect(calls[0][0]).toBe(team.id);
    expect(calls[1][0]).toBe(team.id);
    expect(calls[2][0]).toBe(team.id);

    // Verify the final state is correct
    expect(calls[2][1]).toMatchObject({
      id: task.id,
      title: 'Updated Title 2',
      priority: 'high',
    });
  });

  /**
   * Property 11 Extension: Verify task assignment broadcasts
   * Test that task assignments are broadcast in real-time
   * **Validates: Requirements 3.3**
   */
  it('Property 11: Task assignments are broadcast to all team members', async () => {
    // Create a developer to assign tasks to
    const developerId = await createTestUser('member1@realtime.test', 'Developer');
    await addUserToTeam(team.id, developerId, 'developer');

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          taskTitle: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          taskPriority: fc.constantFrom('low', 'medium', 'high', 'urgent'),
          taskStatus: fc.constantFrom('todo', 'in_progress', 'review', 'done'),
        }),
        async ({ taskTitle, taskPriority, taskStatus }) => {
          vi.clearAllMocks();

          // Create a task
          const task = await createTask(
            {
              teamId: team.id,
              title: taskTitle,
              description: 'Test task for assignment',
              priority: taskPriority,
              status: taskStatus,
            },
            adminId
          );

          vi.clearAllMocks();

          // Assign the task to the developer
          const updatedTask = await updateTask(
            task.id,
            { assigneeId: developerId },
            adminId
          );

          // Verify broadcastTaskUpdated was called for assignment
          expect(socketServer.broadcastTaskUpdated).toHaveBeenCalledTimes(1);
          expect(socketServer.broadcastTaskUpdated).toHaveBeenCalledWith(team.id, updatedTask);

          // Verify the broadcast includes the assignee information
          const broadcastCall = vi.mocked(socketServer.broadcastTaskUpdated).mock.calls[0];
          expect(broadcastCall[0]).toBe(team.id);
          expect(broadcastCall[1]).toMatchObject({
            id: task.id,
            assigneeId: developerId,
          });
        }
      ),
      { numRuns: 100 } // 100+ iterations as required
    );
  });

  /**
   * Property 11 Extension: Verify task detail updates broadcast
   * Test that updates to task details (priority, due date, description) are broadcast
   * **Validates: Requirements 3.3**
   */
  it('Property 11: Task detail updates (priority, due date, description) are broadcast', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          initialPriority: fc.constantFrom('low', 'medium', 'high', 'urgent'),
          updatedPriority: fc.constantFrom('low', 'medium', 'high', 'urgent'),
          description: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
          // Generate a future date for due date
          daysInFuture: fc.integer({ min: 1, max: 365 }),
        }),
        async ({ initialPriority, updatedPriority, description, daysInFuture }) => {
          vi.clearAllMocks();

          // Create a task
          const task = await createTask(
            {
              teamId: team.id,
              title: 'Detail Update Test',
              description: 'Initial description',
              priority: initialPriority,
              status: 'todo',
            },
            adminId
          );

          vi.clearAllMocks();

          // Update task details
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + daysInFuture);

          const updatedTask = await updateTask(
            task.id,
            {
              priority: updatedPriority,
              description,
              dueDate,
            },
            adminId
          );

          // Verify broadcast was called
          expect(socketServer.broadcastTaskUpdated).toHaveBeenCalledTimes(1);
          expect(socketServer.broadcastTaskUpdated).toHaveBeenCalledWith(team.id, updatedTask);

          // Verify the broadcast includes all updated details
          const broadcastCall = vi.mocked(socketServer.broadcastTaskUpdated).mock.calls[0];
          expect(broadcastCall[0]).toBe(team.id);
          expect(broadcastCall[1]).toMatchObject({
            id: task.id,
            priority: updatedPriority,
            description,
          });
          expect(broadcastCall[1].dueDate).toBeDefined();
        }
      ),
      { numRuns: 100 } // 100+ iterations as required
    );
  });

  /**
   * Property 11 Extension: Verify multiple users viewing same board receive updates
   * Test that when multiple users view the same board, all receive synchronization
   * **Validates: Requirements 3.4**
   */
  it('Property 11: Multiple users viewing same board receive synchronized updates', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          numViewers: fc.integer({ min: 2, max: 5 }),
          taskTitle: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          operationType: fc.constantFrom('create', 'update', 'move'),
        }),
        async ({ numViewers, taskTitle, operationType }) => {
          vi.clearAllMocks();

          // Create multiple viewers
          const viewerIds: number[] = [];
          for (let i = 0; i < numViewers; i++) {
            const viewerId = await createTestUser(
              `viewer${i}@realtime.test`,
              `Viewer ${i}`
            );
            await addUserToTeam(team.id, viewerId, 'viewer');
            viewerIds.push(viewerId);
          }

          vi.clearAllMocks();

          // Perform operation based on type
          if (operationType === 'create') {
            await createTask(
              {
                teamId: team.id,
                title: taskTitle,
                description: 'Multi-viewer test',
                priority: 'medium',
                status: 'todo',
              },
              adminId
            );

            // Verify broadcast was called once (to team room, not per viewer)
            expect(socketServer.broadcastTaskCreated).toHaveBeenCalledTimes(1);
            const broadcastCall = vi.mocked(socketServer.broadcastTaskCreated).mock.calls[0];
            expect(broadcastCall[0]).toBe(team.id);

          } else if (operationType === 'update') {
            const task = await createTask(
              {
                teamId: team.id,
                title: taskTitle,
                description: 'Initial',
                priority: 'low',
                status: 'todo',
              },
              adminId
            );

            vi.clearAllMocks();

            await updateTask(task.id, { description: 'Updated by admin' }, adminId);

            // Verify broadcast was called once
            expect(socketServer.broadcastTaskUpdated).toHaveBeenCalledTimes(1);
            const broadcastCall = vi.mocked(socketServer.broadcastTaskUpdated).mock.calls[0];
            expect(broadcastCall[0]).toBe(team.id);

          } else if (operationType === 'move') {
            const task = await createTask(
              {
                teamId: team.id,
                title: taskTitle,
                description: 'Move test',
                priority: 'medium',
                status: 'todo',
              },
              adminId
            );

            vi.clearAllMocks();

            await moveTask(task.id, 'in_progress', 0, adminId);

            // Verify broadcast was called once
            expect(socketServer.broadcastTaskMoved).toHaveBeenCalledTimes(1);
            const broadcastCall = vi.mocked(socketServer.broadcastTaskMoved).mock.calls[0];
            expect(broadcastCall[0]).toBe(team.id);
          }

          // The key property: broadcast goes to team room once, not per viewer
          // Socket.io room-based broadcasting ensures all subscribed viewers receive it
          // This validates that the synchronization is efficient and scalable
        }
      ),
      { numRuns: 100 } // 100+ iterations as required
    );
  });

  /**
   * Property 11 Extension: Verify task movements between columns broadcast correctly
   * Test that dragging tasks between columns broadcasts the correct state
   * **Validates: Requirements 3.2**
   */
  it('Property 11: Task movements between columns broadcast correct state', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          fromStatus: fc.constantFrom('todo', 'in_progress', 'review', 'done'),
          toStatus: fc.constantFrom('todo', 'in_progress', 'review', 'done'),
          position: fc.integer({ min: 0, max: 10 }),
        }).filter(({ fromStatus, toStatus }) => fromStatus !== toStatus), // Only test actual moves
        async ({ fromStatus, toStatus, position }) => {
          vi.clearAllMocks();

          // Create a task in the initial status
          const task = await createTask(
            {
              teamId: team.id,
              title: 'Column Move Test',
              description: 'Testing column movement',
              priority: 'medium',
              status: fromStatus,
            },
            adminId
          );

          vi.clearAllMocks();

          // Move task to new status
          await moveTask(task.id, toStatus, position, adminId);

          // Verify broadcastTaskMoved was called
          expect(socketServer.broadcastTaskMoved).toHaveBeenCalledTimes(1);
          expect(socketServer.broadcastTaskMoved).toHaveBeenCalledWith(
            team.id,
            task.id,
            toStatus,
            position
          );

          // Verify the broadcast includes correct movement data
          const broadcastCall = vi.mocked(socketServer.broadcastTaskMoved).mock.calls[0];
          expect(broadcastCall[0]).toBe(team.id);
          expect(broadcastCall[1]).toBe(task.id);
          expect(broadcastCall[2]).toBe(toStatus);
          expect(broadcastCall[3]).toBe(position);
        }
      ),
      { numRuns: 100 } // 100+ iterations as required
    );
  });
});
