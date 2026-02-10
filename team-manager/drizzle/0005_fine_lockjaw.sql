CREATE INDEX `activities_teamId_createdAt_idx` ON `activities` (`teamId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `oauthTokens_userId_provider_idx` ON `oauthTokens` (`userId`,`provider`);--> statement-breakpoint
CREATE INDEX `repositories_teamId_idx` ON `repositories` (`teamId`);--> statement-breakpoint
CREATE INDEX `tasks_teamId_idx` ON `tasks` (`teamId`);--> statement-breakpoint
CREATE INDEX `tasks_assigneeId_idx` ON `tasks` (`assigneeId`);--> statement-breakpoint
CREATE INDEX `tasks_status_idx` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `teamMembersCollaborative_teamId_idx` ON `teamMembersCollaborative` (`teamId`);--> statement-breakpoint
CREATE INDEX `teamMembersCollaborative_userId_idx` ON `teamMembersCollaborative` (`userId`);