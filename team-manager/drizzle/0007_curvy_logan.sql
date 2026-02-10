CREATE TABLE `activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`teamId` integer NOT NULL,
	`userId` integer NOT NULL,
	`type` text NOT NULL,
	`entityId` text NOT NULL,
	`entityType` text NOT NULL,
	`metadata` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`teamId`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `activities_teamId_createdAt_idx` ON `activities` (`teamId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `auditLogs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`operation` text NOT NULL,
	`entityType` text NOT NULL,
	`entityId` integer NOT NULL,
	`userId` integer,
	`details` text,
	`timestamp` integer NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	FOREIGN KEY (`userId`) REFERENCES `teamMembers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `departmentAssignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`teamMemberId` integer NOT NULL,
	`departmentId` integer NOT NULL,
	`assignedAt` integer NOT NULL,
	`assignedBy` integer,
	`isActive` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`teamMemberId`) REFERENCES `teamMembers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assignedBy`) REFERENCES `teamMembers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `departments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`parentId` integer,
	`managerId` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `departments_name_unique` ON `departments` (`name`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`teamId` integer NOT NULL,
	`name` text NOT NULL,
	`yjsState` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`teamId`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `oauthTokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`provider` text NOT NULL,
	`accessToken` text NOT NULL,
	`refreshToken` text,
	`expiresAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `oauthTokens_userId_provider_idx` ON `oauthTokens` (`userId`,`provider`);--> statement-breakpoint
CREATE TABLE `repositories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`teamId` integer NOT NULL,
	`githubId` integer NOT NULL,
	`name` text NOT NULL,
	`fullName` text NOT NULL,
	`url` text NOT NULL,
	`accessToken` text NOT NULL,
	`webhookSecret` text NOT NULL,
	`lastSyncAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`teamId`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `repositories_teamId_idx` ON `repositories` (`teamId`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`teamId` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`assigneeId` integer,
	`priority` text NOT NULL,
	`status` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`githubPrUrl` text,
	`dueDate` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`teamId`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigneeId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `tasks_teamId_idx` ON `tasks` (`teamId`);--> statement-breakpoint
CREATE INDEX `tasks_assigneeId_idx` ON `tasks` (`assigneeId`);--> statement-breakpoint
CREATE INDEX `tasks_status_idx` ON `tasks` (`status`);--> statement-breakpoint
CREATE TABLE `teamInvitations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`teamId` integer NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`token` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`acceptedAt` integer,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`teamId`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teamInvitations_token_unique` ON `teamInvitations` (`token`);--> statement-breakpoint
CREATE TABLE `teamMembers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`position` text NOT NULL,
	`duties` text,
	`email` text,
	`phone` text,
	`pictureFileName` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `teamMembersCollaborative` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`teamId` integer NOT NULL,
	`userId` integer NOT NULL,
	`role` text NOT NULL,
	`joinedAt` integer NOT NULL,
	FOREIGN KEY (`teamId`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `teamMembersCollaborative_teamId_idx` ON `teamMembersCollaborative` (`teamId`);--> statement-breakpoint
CREATE INDEX `teamMembersCollaborative_userId_idx` ON `teamMembersCollaborative` (`userId`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`ownerId` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
