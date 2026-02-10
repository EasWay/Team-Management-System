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
CREATE TABLE `teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`ownerId` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`openId` text,
	`githubId` text,
	`googleId` text,
	`name` text,
	`email` text,
	`loginMethod` text,
	`role` text DEFAULT 'user' NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`lastSignedIn` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "openId", "name", "email", "loginMethod", "role", "createdAt", "updatedAt", "lastSignedIn") SELECT "id", "openId", "name", "email", "loginMethod", "role", "createdAt", "updatedAt", "lastSignedIn" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `users_openId_unique` ON `users` (`openId`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_githubId_unique` ON `users` (`githubId`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_googleId_unique` ON `users` (`googleId`);