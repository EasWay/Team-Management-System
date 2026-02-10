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
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_departments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`parentId` integer,
	`managerId` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_departments`("id", "name", "description", "parentId", "managerId", "createdAt", "updatedAt") SELECT "id", "name", "description", "parentId", "managerId", "createdAt", "updatedAt" FROM `departments`;--> statement-breakpoint
DROP TABLE `departments`;--> statement-breakpoint
ALTER TABLE `__new_departments` RENAME TO `departments`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `departments_name_unique` ON `departments` (`name`);