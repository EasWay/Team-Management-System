import { relations } from 'drizzle-orm';
import {
  users,
  teams,
  teamMembersCollaborative,
  teamInvitations,
  tasks,
  documents,
  repositories,
  activities,
  oauthTokens,
} from './schema';

// User relations
export const usersRelations = relations(users, ({ many }) => ({
  ownedTeams: many(teams),
  teamMemberships: many(teamMembersCollaborative),
  assignedTasks: many(tasks),
  activities: many(activities),
  oauthTokens: many(oauthTokens),
}));

// Team relations
export const teamsRelations = relations(teams, ({ one, many }) => ({
  owner: one(users, {
    fields: [teams.ownerId],
    references: [users.id],
  }),
  members: many(teamMembersCollaborative),
  invitations: many(teamInvitations),
  tasks: many(tasks),
  documents: many(documents),
  repositories: many(repositories),
  activities: many(activities),
}));

// Team member relations
export const teamMembersCollaborativeRelations = relations(teamMembersCollaborative, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembersCollaborative.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teamMembersCollaborative.userId],
    references: [users.id],
  }),
}));

// Team invitation relations
export const teamInvitationsRelations = relations(teamInvitations, ({ one }) => ({
  team: one(teams, {
    fields: [teamInvitations.teamId],
    references: [teams.id],
  }),
}));

// Task relations
export const tasksRelations = relations(tasks, ({ one }) => ({
  team: one(teams, {
    fields: [tasks.teamId],
    references: [teams.id],
  }),
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
  }),
}));

// Document relations
export const documentsRelations = relations(documents, ({ one }) => ({
  team: one(teams, {
    fields: [documents.teamId],
    references: [teams.id],
  }),
}));

// Repository relations
export const repositoriesRelations = relations(repositories, ({ one }) => ({
  team: one(teams, {
    fields: [repositories.teamId],
    references: [teams.id],
  }),
}));

// Activity relations
export const activitiesRelations = relations(activities, ({ one }) => ({
  team: one(teams, {
    fields: [activities.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [activities.userId],
    references: [users.id],
  }),
}));

// OAuth token relations
export const oauthTokensRelations = relations(oauthTokens, ({ one }) => ({
  user: one(users, {
    fields: [oauthTokens.userId],
    references: [users.id],
  }),
}));
