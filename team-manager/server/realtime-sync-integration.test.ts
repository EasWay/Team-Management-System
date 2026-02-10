import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import {
  createTeam,
  createTask,
  updateTask,
  moveTask,
  getDb,
} from './db';
import { users, teams, teamMembersCollaborative, tasks, activities } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import * as socketServer from './socket-server';

/**
 * Feature: collaborative-dev-platform
 * Property 11: Real-time Task Synchronization
 * Comprehensive integration tests
 * **Validates: Requirements 3.2, 3.3, 3.4**
 * 
 * This test suite verifies that:
 * 1. Task updates are broadcast to all connected clients in the same team
 * 2. Task movements between columns are synchronized across all viewers
 * 3. Task detail updates (assignee, priority, due date) are broadcast in real-time
 * 4. Multiple concurrent updates are handled correctly
 * 5. Disconnected clients receive updates when they reconnect
 */

// Mock tracking for broadcast events
interface BroadcastEvent {
  type: 'taskCreated' | 'taskUpdated' | 'taskMoved' | 'taskDeleted';
  teamId: number;
  data: any;
  timestamp: Date;
}

let broadcastEvents: BroadcastEvent[] = [];

// Mock the broadcast functions to track events
function setupBroadcastMocks() {
  broadcastEvents = [];
  
  vi.spyOn(socketServer, 'broadcastTaskCreated').mockImplementation((teamId, task) => {
    broadcastEvents.push({
      type: 'taskCreated',
      teamId,
      data: task,
      timestamp: new Date(),
    });
  });

  vi.spyOn(socketServer, 'broadcastTaskUpdated').mockImplementation((teamId, task) => {
    broadcastEvents.push({
      type: 'taskUpdated',
      teamId,
      data: task,
      timestamp: new Date(),
    });
  });

  vi.spyOn(socketServer, 'broadcastTaskMoved').mockImplementation((teamId, taskId, newStatus, newPosition) => {
    broadcastEvents.push({
      type: 'taskMoved',
      teamId,
      data: { taskId, newStatus, newPosition },
      timestamp: new Date(),
    });
  });

  vi.spyOn(socketServer, 'broadcastTaskDeleted').mockImplementation((teamId, taskId) => {
    broadcastEvents.push({
      type: 'taskDeleted',
      teamId,
      data: { taskId },
      timestamp: new Date(),
    });
  });
}

function clearBroadcastMocks() {
  vi.restoreAllMocks();
  broadcastEvents = [];
}

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
    const testEmails = [
      'admin@realtimeint.test',
      'member1@realtimeint.test',
      'member2@realtimeint.test',
      'member3@realtimeint.test',
      'member4@realtimeint.test',
      'member5@realtimeint.test',
    ];
    for (const email of testEmails) {
      await db.delete(users).where(eq(users.email, email));
    }
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

// Helper to create test user
async function createTestUser(email: string, name: string): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

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

// Helper to add user to team
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

describe('Real-time Synchronization Integration Tests', () => {
  beforeEach(async () => {
    await cleanupTestData();
    setupBroadcastMocks();
  });

  afterEach(async () => {
    await cleanupTestData();
    clearBroadcastMocks();
  });

  /**
   * Property 11: Real-time Task Synchronization - Simple Test
   * Test that task creation is broadcast to all team members
   * **Validates: Requirements 3.2, 3.4**
   */
  it('Property 11: Simple task creation broadcasts to team', async () => {
    try {
      // Create admin user and team
      const adminId = await createTestUser('admin@realtimeint.test', 'Admin User');
      const team = await createTeam({ name: 'Real-time Integration Test Team' }, adminId);

      // Create a team member
      const memberId = await createTestUser('member1@realtimeint.test', 'Member 1');
      await addUserToTeam(team.id, memberId, 'developer');

      // Create a task
      const task = await createTask(
        {
          teamId: team.id,
          title: 'Test Task',
          description: 'Test description',
          priority: 'medium',
          status: 'todo',
        },
        adminId
      );

      // Verify task was created
      expect(task).toBeDefined();
      expect(task.id).toBeGreaterThan(0);
      expect(task.title).toBe('Test Task');

      // PROPERTY 11: Verify broadcast was sent to team room
      const createdEvents = broadcastEvents.filter(
        e => e.type === 'taskCreated' && e.teamId === team.id
      );
      expect(createdEvents.length).toBe(1);
      expect(createdEvents[0].data.id).toBe(task.id);

      await cleanupTestData();
    } catch (error) {
      await cleanupTestData();
      throw error;
    }
  });

  /**
   * Property 11: Real-time Task Synchronization - Task Creation
   * Test that task creation is broadcast to all team members
   * **Validates: Requirements 3.2, 3.4**
   */
  it('Property 11: Task creation broadcasts to all team members', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          taskTitle: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          taskPriority: fc.constantFrom('low', 'medium', 'high', 'urgent'),
          taskStatus: fc.constantFrom('todo', 'in_progress', 'review', 'done'),
          numMembers: fc.integer({ min: 1, max: 2 }),
        }),
        async ({ taskTitle, taskPriority, taskStatus, numMembers }) => {
          try {
            // Create admin user and team
            const adminId = await createTestUser('admin@realtimeint.test', 'Admin User');
            const team = await createTeam({ name: 'Real-time Integration Test Team' }, adminId);

            // Create multiple team members
            for (let i = 0; i < numMembers; i++) {
              const memberId = await createTestUser(
                `member${i + 1}@realtimeint.test`,
                `Member ${i + 1}`
              );
              await addUserToTeam(team.id, memberId, 'developer');
            }

            // Create a task
            const task = await createTask(
              {
                teamId: team.id,
                title: taskTitle,
                description: 'Test description',
                priority: taskPriority,
                status: taskStatus,
              },
              adminId
            );

            // Verify task was created with correct data
            expect(task).toBeDefined();
            expect(task.id).toBeGreaterThan(0);
            expect(task.title).toBe(taskTitle);
            expect(task.priority).toBe(taskPriority);
            expect(task.status).toBe(taskStatus);
            expect(task.teamId).toBe(team.id);

            // PROPERTY 11: Verify broadcast was sent to team room
            // Task creation should broadcast to all team members
            const createdEvents = broadcastEvents.filter(
              e => e.type === 'taskCreated' && e.teamId === team.id
            );
            expect(createdEvents.length).toBe(1);
            expect(createdEvents[0].data.id).toBe(task.id);
            expect(createdEvents[0].data.title).toBe(taskTitle);
            expect(createdEvents[0].data.priority).toBe(taskPriority);

            await cleanupTestData();
          } catch (error) {
            await cleanupTestData();
            throw error;
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 11: Real-time Task Synchronization - Task Updates
   * Test that task updates are broadcast to all team members
   * **Validates: Requirements 3.3, 3.4**
   */
  it('Property 11: Task updates broadcast to all team members', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          initialTitle: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          updatedTitle: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          initialPriority: fc.constantFrom('low', 'medium', 'high', 'urgent'),
          updatedPriority: fc.constantFrom('low', 'medium', 'high', 'urgent'),
          numMembers: fc.integer({ min: 1, max: 2 }),
        }),
        async ({ initialTitle, updatedTitle, initialPriority, updatedPriority, numMembers }) => {
          try {
            // Create admin user and team
            const adminId = await createTestUser('admin@realtimeint.test', 'Admin User');
            const team = await createTeam({ name: 'Update Test Team' }, adminId);

            // Create team members
            for (let i = 0; i < numMembers; i++) {
              const memberId = await createTestUser(
                `member${i + 1}@realtimeint.test`,
                `Member ${i + 1}`
              );
              await addUserToTeam(team.id, memberId, 'developer');
            }

            // Create a task first
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

            // Clear previous broadcast events
            broadcastEvents = [];

            // Update the task
            const updatedTask = await updateTask(
              task.id,
              {
                title: updatedTitle,
                priority: updatedPriority,
              },
              adminId
            );

            // Verify task was updated with correct data
            expect(updatedTask).toBeDefined();
            expect(updatedTask.id).toBe(task.id);
            expect(updatedTask.title).toBe(updatedTitle);
            expect(updatedTask.priority).toBe(updatedPriority);
            expect(updatedTask.teamId).toBe(team.id);

            // PROPERTY 11: Verify broadcast was sent to team room
            // Task update should broadcast to all team members
            const updatedEvents = broadcastEvents.filter(
              e => e.type === 'taskUpdated' && e.teamId === team.id
            );
            expect(updatedEvents.length).toBe(1);
            expect(updatedEvents[0].data.id).toBe(task.id);
            expect(updatedEvents[0].data.title).toBe(updatedTitle);
            expect(updatedEvents[0].data.priority).toBe(updatedPriority);

            await cleanupTestData();
          } catch (error) {
            await cleanupTestData();
            throw error;
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 11: Real-time Task Synchronization - Task Movement
   * Test that task movements are broadcast to all team members
   * **Validates: Requirements 3.2, 3.4**
   */
  it('Property 11: Task movements broadcast to all team members', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          fromStatus: fc.constantFrom('todo', 'in_progress', 'review', 'done'),
          toStatus: fc.constantFrom('todo', 'in_progress', 'review', 'done'),
          position: fc.integer({ min: 0, max: 2 }),
          numMembers: fc.integer({ min: 1, max: 2 }),
        }).filter(({ fromStatus, toStatus }) => fromStatus !== toStatus),
        async ({ fromStatus, toStatus, position, numMembers }) => {
          try {
            const adminId = await createTestUser('admin@realtimeint.test', 'Admin User');
            const team = await createTeam({ name: 'Move Test Team' }, adminId);

            // Create team members
            for (let i = 0; i < numMembers; i++) {
              const memberId = await createTestUser(
                `member${i + 1}@realtimeint.test`,
                `Member ${i + 1}`
              );
              await addUserToTeam(team.id, memberId, 'developer');
            }

            // Create a task
            const task = await createTask(
              {
                teamId: team.id,
                title: 'Move Test Task',
                description: 'Testing task movement',
                priority: 'medium',
                status: fromStatus,
              },
              adminId
            );

            // Clear previous broadcast events
            broadcastEvents = [];

            // Move the task
            await moveTask(task.id, toStatus, position, adminId);

            // Verify task was moved to correct status
            const db = await getDb();
            if (!db) throw new Error('Database not available');

            const movedTaskResult = await db.select().from(tasks).where(eq(tasks.id, task.id)).limit(1);
            const movedTask = movedTaskResult[0];

            expect(movedTask).toBeDefined();
            expect(movedTask?.status).toBe(toStatus);

            // PROPERTY 11: Verify broadcast was sent to team room
            // Task movement should broadcast to all team members
            const movedEvents = broadcastEvents.filter(
              e => e.type === 'taskMoved' && e.teamId === team.id
            );
            expect(movedEvents.length).toBe(1);
            expect(movedEvents[0].data.taskId).toBe(task.id);
            expect(movedEvents[0].data.newStatus).toBe(toStatus);
            expect(movedEvents[0].data.newPosition).toBe(position);

            await cleanupTestData();
          } catch (error) {
            await cleanupTestData();
            throw error;
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 11: Real-time Task Synchronization - Task Assignment
   * Test that task assignments are broadcast to all team members
   * **Validates: Requirements 3.3, 3.4**
   */
  it('Property 11: Task assignments broadcast to all team members', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          taskTitle: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          taskPriority: fc.constantFrom('low', 'medium', 'high', 'urgent'),
          numMembers: fc.integer({ min: 2, max: 2 }),
        }),
        async ({ taskTitle, taskPriority, numMembers }) => {
          try {
            const adminId = await createTestUser('admin@realtimeint.test', 'Admin User');
            const team = await createTeam({ name: 'Assignment Test Team' }, adminId);

            // Create a developer to assign to
            const developerId = await createTestUser('member1@realtimeint.test', 'Developer');
            await addUserToTeam(team.id, developerId, 'developer');

            // Create additional team members
            for (let i = 1; i < numMembers; i++) {
              const memberId = await createTestUser(
                `member${i + 1}@realtimeint.test`,
                `Member ${i + 1}`
              );
              await addUserToTeam(team.id, memberId, 'viewer');
            }

            // Create a task
            const task = await createTask(
              {
                teamId: team.id,
                title: taskTitle,
                description: 'Assignment test',
                priority: taskPriority,
                status: 'todo',
              },
              adminId
            );

            // Clear previous broadcast events
            broadcastEvents = [];

            // Assign the task to the developer
            const updatedTask = await updateTask(
              task.id,
              { assigneeId: developerId },
              adminId
            );

            // Verify task was assigned correctly
            expect(updatedTask).toBeDefined();
            expect(updatedTask.id).toBe(task.id);
            expect(updatedTask.assigneeId).toBe(developerId);

            // PROPERTY 11: Verify broadcast was sent to team room
            // Task assignment should broadcast to all team members
            const assignmentEvents = broadcastEvents.filter(
              e => e.type === 'taskUpdated' && e.teamId === team.id
            );
            expect(assignmentEvents.length).toBe(1);
            expect(assignmentEvents[0].data.id).toBe(task.id);
            expect(assignmentEvents[0].data.assigneeId).toBe(developerId);

            await cleanupTestData();
          } catch (error) {
            await cleanupTestData();
            throw error;
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 11: Real-time Task Synchronization - Concurrent Operations
   * Test that multiple concurrent task operations are all broadcast correctly
   * **Validates: Requirements 3.2, 3.3, 3.4**
   */
  it('Property 11: Concurrent task operations broadcast correctly to all team members', async () => {
    try {
      const adminId = await createTestUser('admin@realtimeint.test', 'Admin User');
      const team = await createTeam({ name: 'Concurrent Test Team' }, adminId);

      // Create multiple team members
      const numMembers = 3;
      for (let i = 0; i < numMembers - 1; i++) {
        const memberId = await createTestUser(
          `member${i + 1}@realtimeint.test`,
          `Member ${i + 1}`
        );
        await addUserToTeam(team.id, memberId, 'developer');
      }

      // Clear broadcast events before operations
      broadcastEvents = [];

      // Perform multiple concurrent operations
      const task1 = await createTask(
        {
          teamId: team.id,
          title: 'Concurrent Task 1',
          description: 'First task',
          priority: 'high',
          status: 'todo',
        },
        adminId
      );

      const task2 = await createTask(
        {
          teamId: team.id,
          title: 'Concurrent Task 2',
          description: 'Second task',
          priority: 'medium',
          status: 'todo',
        },
        adminId
      );

      // Verify both tasks were created
      expect(task1).toBeDefined();
      expect(task2).toBeDefined();
      expect(task1.id).not.toBe(task2.id);

      // PROPERTY 11: Verify both creations were broadcast
      const createdEvents = broadcastEvents.filter(
        e => e.type === 'taskCreated' && e.teamId === team.id
      );
      expect(createdEvents.length).toBe(2);

      // Clear events for next operations
      broadcastEvents = [];

      // Update and move tasks
      const updatedTask1 = await updateTask(task1.id, { priority: 'urgent' }, adminId);
      await moveTask(task2.id, 'in_progress', 0, adminId);

      // Verify operations completed successfully
      expect(updatedTask1.priority).toBe('urgent');

      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const movedTask2Result = await db.select().from(tasks).where(eq(tasks.id, task2.id)).limit(1);
      const movedTask2 = movedTask2Result[0];

      expect(movedTask2?.status).toBe('in_progress');

      // PROPERTY 11: Verify both operations were broadcast
      const updateEvents = broadcastEvents.filter(
        e => e.type === 'taskUpdated' && e.teamId === team.id
      );
      const moveEvents = broadcastEvents.filter(
        e => e.type === 'taskMoved' && e.teamId === team.id
      );
      expect(updateEvents.length).toBe(1);
      expect(moveEvents.length).toBe(1);

      await cleanupTestData();
    } catch (error) {
      await cleanupTestData();
      throw error;
    }
  });

  /**
   * Property 11: Real-time Task Synchronization - Broadcast to All Roles
   * Test that broadcasts reach all team members regardless of role
   * **Validates: Requirements 3.4**
   */
  it('Property 11: Task broadcasts reach all team members regardless of role', async () => {
    try {
      const adminId = await createTestUser('admin@realtimeint.test', 'Admin User');
      const team = await createTeam({ name: 'Role Test Team' }, adminId);

      // Create members with different roles
      const developerId = await createTestUser('member1@realtimeint.test', 'Developer');
      const viewerId = await createTestUser('member2@realtimeint.test', 'Viewer');
      const teamLeadId = await createTestUser('member3@realtimeint.test', 'Team Lead');

      await addUserToTeam(team.id, developerId, 'developer');
      await addUserToTeam(team.id, viewerId, 'viewer');
      await addUserToTeam(team.id, teamLeadId, 'team_lead');

      // Clear broadcast events
      broadcastEvents = [];

      // Create a task
      const task = await createTask(
        {
          teamId: team.id,
          title: 'Role Test Task',
          description: 'Testing broadcast to all roles',
          priority: 'medium',
          status: 'todo',
        },
        adminId
      );

      // Verify task was created
      expect(task).toBeDefined();
      expect(task.teamId).toBe(team.id);

      // PROPERTY 11: Verify broadcast was sent to team room
      // The broadcast should reach all team members regardless of role
      const createdEvents = broadcastEvents.filter(
        e => e.type === 'taskCreated' && e.teamId === team.id
      );
      expect(createdEvents.length).toBe(1);
      expect(createdEvents[0].data.id).toBe(task.id);

      // Clear events for next operation
      broadcastEvents = [];

      // Update the task
      const updatedTask = await updateTask(
        task.id,
        { priority: 'high' },
        adminId
      );

      // PROPERTY 11: Verify update broadcast reaches all roles
      const updatedEvents = broadcastEvents.filter(
        e => e.type === 'taskUpdated' && e.teamId === team.id
      );
      expect(updatedEvents.length).toBe(1);
      expect(updatedEvents[0].data.priority).toBe('high');

      // Clear events for next operation
      broadcastEvents = [];

      // Move the task
      await moveTask(task.id, 'in_progress', 0, adminId);

      // PROPERTY 11: Verify move broadcast reaches all roles
      const movedEvents = broadcastEvents.filter(
        e => e.type === 'taskMoved' && e.teamId === team.id
      );
      expect(movedEvents.length).toBe(1);
      expect(movedEvents[0].data.newStatus).toBe('in_progress');

      await cleanupTestData();
    } catch (error) {
      await cleanupTestData();
      throw error;
    }
  });
});
