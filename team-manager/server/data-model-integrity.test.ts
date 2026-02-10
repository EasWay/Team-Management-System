import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type {
  User,
  Team,
  TeamMemberCollaborative,
  TeamInvitation,
  Task,
  Document,
  Repository,
  Activity,
  OAuthToken,
} from '../drizzle/schema';

/**
 * Feature: collaborative-dev-platform
 * Property 36: JSON Round-trip Consistency
 * 
 * Test that all data models can be serialized to JSON and parsed back without data loss
 * **Validates: Requirements 9.4**
 */

// Generators for each data model
const userGenerator = (): fc.Arbitrary<User> => fc.record({
  id: fc.integer({ min: 1 }),
  openId: fc.option(fc.string(), { nil: null }),
  githubId: fc.option(fc.string(), { nil: null }),
  googleId: fc.option(fc.string(), { nil: null }),
  name: fc.option(fc.string(), { nil: null }),
  email: fc.option(fc.string(), { nil: null }),
  loginMethod: fc.option(fc.string(), { nil: null }),
  role: fc.constantFrom('user', 'admin'),
  createdAt: fc.date(),
  updatedAt: fc.date(),
  lastSignedIn: fc.date(),
});

const teamGenerator = (): fc.Arbitrary<Team> => fc.record({
  id: fc.integer({ min: 1 }),
  name: fc.string({ minLength: 1 }),
  description: fc.option(fc.string(), { nil: null }),
  ownerId: fc.integer({ min: 1 }),
  createdAt: fc.date(),
  updatedAt: fc.date(),
});

const teamMemberCollaborativeGenerator = (): fc.Arbitrary<TeamMemberCollaborative> => fc.record({
  id: fc.integer({ min: 1 }),
  teamId: fc.integer({ min: 1 }),
  userId: fc.integer({ min: 1 }),
  role: fc.constantFrom('admin', 'team_lead', 'developer', 'viewer'),
  joinedAt: fc.date(),
});

const teamInvitationGenerator = (): fc.Arbitrary<TeamInvitation> => fc.record({
  id: fc.integer({ min: 1 }),
  teamId: fc.integer({ min: 1 }),
  email: fc.emailAddress(),
  role: fc.constantFrom('admin', 'team_lead', 'developer', 'viewer'),
  token: fc.string({ minLength: 10 }),
  expiresAt: fc.date(),
  acceptedAt: fc.option(fc.date(), { nil: null }),
  createdAt: fc.date(),
});

const taskGenerator = (): fc.Arbitrary<Task> => fc.record({
  id: fc.integer({ min: 1 }),
  teamId: fc.integer({ min: 1 }),
  title: fc.string({ minLength: 1 }),
  description: fc.option(fc.string(), { nil: null }),
  assigneeId: fc.option(fc.integer({ min: 1 }), { nil: null }),
  priority: fc.constantFrom('low', 'medium', 'high', 'urgent'),
  status: fc.constantFrom('todo', 'in_progress', 'review', 'done'),
  position: fc.integer({ min: 0 }),
  githubPrUrl: fc.option(fc.webUrl(), { nil: null }),
  dueDate: fc.option(fc.date(), { nil: null }),
  createdAt: fc.date(),
  updatedAt: fc.date(),
});

const documentGenerator = (): fc.Arbitrary<Document> => fc.record({
  id: fc.integer({ min: 1 }),
  teamId: fc.integer({ min: 1 }),
  name: fc.string({ minLength: 1 }),
  yjsState: fc.option(fc.string(), { nil: null }),
  createdAt: fc.date(),
  updatedAt: fc.date(),
});

const repositoryGenerator = (): fc.Arbitrary<Repository> => fc.record({
  id: fc.integer({ min: 1 }),
  teamId: fc.integer({ min: 1 }),
  githubId: fc.integer({ min: 1 }),
  name: fc.string({ minLength: 1 }),
  fullName: fc.string({ minLength: 1 }),
  url: fc.webUrl(),
  accessToken: fc.string({ minLength: 10 }),
  webhookSecret: fc.string({ minLength: 10 }),
  lastSyncAt: fc.option(fc.date(), { nil: null }),
  createdAt: fc.date(),
  updatedAt: fc.date(),
});

const activityGenerator = (): fc.Arbitrary<Activity> => fc.record({
  id: fc.integer({ min: 1 }),
  teamId: fc.integer({ min: 1 }),
  userId: fc.integer({ min: 1 }),
  type: fc.constantFrom('task_created', 'task_updated', 'commit_pushed', 'pr_opened'),
  entityId: fc.string({ minLength: 1 }),
  entityType: fc.constantFrom('task', 'commit', 'pr', 'issue'),
  metadata: fc.option(fc.string(), { nil: null }),
  createdAt: fc.date(),
});

const oauthTokenGenerator = (): fc.Arbitrary<OAuthToken> => fc.record({
  id: fc.integer({ min: 1 }),
  userId: fc.integer({ min: 1 }),
  provider: fc.constantFrom('github', 'google', 'manus'),
  accessToken: fc.string({ minLength: 10 }),
  refreshToken: fc.option(fc.string({ minLength: 10 }), { nil: null }),
  expiresAt: fc.option(fc.date(), { nil: null }),
  createdAt: fc.date(),
  updatedAt: fc.date(),
});

// Helper function to compare objects with Date handling
function deepEqualWithDates(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;
  if (obj1 == null || obj2 == null) return false;
  if (typeof obj1 !== typeof obj2) return false;
  
  if (obj1 instanceof Date && obj2 instanceof Date) {
    // Handle invalid dates (NaN)
    const time1 = obj1.getTime();
    const time2 = obj2.getTime();
    if (isNaN(time1) && isNaN(time2)) return true;
    return time1 === time2;
  }
  
  if (typeof obj1 === 'object') {
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) return false;
    
    for (const key of keys1) {
      if (!deepEqualWithDates(obj1[key], obj2[key])) return false;
    }
    
    return true;
  }
  
  return false;
}

describe('Data Model Integrity - Property 36: JSON Round-trip Consistency', () => {
  it('User model should survive JSON round-trip', () => {
    fc.assert(
      fc.property(userGenerator(), (user) => {
        const json = JSON.stringify(user);
        const parsed = JSON.parse(json, (key, value) => {
          // Revive Date objects
          if (key === 'createdAt' || key === 'updatedAt' || key === 'lastSignedIn') {
            return value ? new Date(value) : null;
          }
          return value;
        });
        
        expect(deepEqualWithDates(user, parsed)).toBe(true);
      }),
      { numRuns: 10 }
    );
  });

  it('Team model should survive JSON round-trip', () => {
    fc.assert(
      fc.property(teamGenerator(), (team) => {
        const json = JSON.stringify(team);
        const parsed = JSON.parse(json, (key, value) => {
          if (key === 'createdAt' || key === 'updatedAt') {
            return value ? new Date(value) : null;
          }
          return value;
        });
        
        expect(deepEqualWithDates(team, parsed)).toBe(true);
      }),
      { numRuns: 10 }
    );
  });

  it('TeamMemberCollaborative model should survive JSON round-trip', () => {
    fc.assert(
      fc.property(teamMemberCollaborativeGenerator(), (member) => {
        const json = JSON.stringify(member);
        const parsed = JSON.parse(json, (key, value) => {
          if (key === 'joinedAt') {
            return value ? new Date(value) : null;
          }
          return value;
        });
        
        expect(deepEqualWithDates(member, parsed)).toBe(true);
      }),
      { numRuns: 10 }
    );
  });

  it('TeamInvitation model should survive JSON round-trip', () => {
    fc.assert(
      fc.property(teamInvitationGenerator(), (invitation) => {
        const json = JSON.stringify(invitation);
        const parsed = JSON.parse(json, (key, value) => {
          if (key === 'expiresAt' || key === 'acceptedAt' || key === 'createdAt') {
            return value ? new Date(value) : null;
          }
          return value;
        });
        
        expect(deepEqualWithDates(invitation, parsed)).toBe(true);
      }),
      { numRuns: 10 }
    );
  });

  it('Task model should survive JSON round-trip', () => {
    fc.assert(
      fc.property(taskGenerator(), (task) => {
        const json = JSON.stringify(task);
        const parsed = JSON.parse(json, (key, value) => {
          if (key === 'dueDate' || key === 'createdAt' || key === 'updatedAt') {
            return value ? new Date(value) : null;
          }
          return value;
        });
        
        expect(deepEqualWithDates(task, parsed)).toBe(true);
      }),
      { numRuns: 10 }
    );
  });

  it('Document model should survive JSON round-trip', () => {
    fc.assert(
      fc.property(documentGenerator(), (document) => {
        const json = JSON.stringify(document);
        const parsed = JSON.parse(json, (key, value) => {
          if (key === 'createdAt' || key === 'updatedAt') {
            return value ? new Date(value) : null;
          }
          return value;
        });
        
        expect(deepEqualWithDates(document, parsed)).toBe(true);
      }),
      { numRuns: 10 }
    );
  });

  it('Repository model should survive JSON round-trip', () => {
    fc.assert(
      fc.property(repositoryGenerator(), (repository) => {
        const json = JSON.stringify(repository);
        const parsed = JSON.parse(json, (key, value) => {
          if (key === 'lastSyncAt' || key === 'createdAt' || key === 'updatedAt') {
            return value ? new Date(value) : null;
          }
          return value;
        });
        
        expect(deepEqualWithDates(repository, parsed)).toBe(true);
      }),
      { numRuns: 10 }
    );
  });

  it('Activity model should survive JSON round-trip', () => {
    fc.assert(
      fc.property(activityGenerator(), (activity) => {
        const json = JSON.stringify(activity);
        const parsed = JSON.parse(json, (key, value) => {
          if (key === 'createdAt') {
            return value ? new Date(value) : null;
          }
          return value;
        });
        
        expect(deepEqualWithDates(activity, parsed)).toBe(true);
      }),
      { numRuns: 10 }
    );
  });

  it('OAuthToken model should survive JSON round-trip', () => {
    fc.assert(
      fc.property(oauthTokenGenerator(), (token) => {
        const json = JSON.stringify(token);
        const parsed = JSON.parse(json, (key, value) => {
          if (key === 'expiresAt' || key === 'createdAt' || key === 'updatedAt') {
            return value ? new Date(value) : null;
          }
          return value;
        });
        
        expect(deepEqualWithDates(token, parsed)).toBe(true);
      }),
      { numRuns: 10 }
    );
  });
});
