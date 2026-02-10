PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_departmentAssignments` (
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
INSERT INTO `__new_departmentAssignments`("id", "teamMemberId", "departmentId", "assignedAt", "assignedBy", "isActive") SELECT "id", "teamMemberId", "departmentId", "assignedAt", "assignedBy", "isActive" FROM `departmentAssignments`;--> statement-breakpoint
DROP TABLE `departmentAssignments`;--> statement-breakpoint
ALTER TABLE `__new_departmentAssignments` RENAME TO `departmentAssignments`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_departments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`parentId` integer,
	`managerId` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`parentId`) REFERENCES `departments`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`managerId`) REFERENCES `teamMembers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_departments`("id", "name", "description", "parentId", "managerId", "createdAt", "updatedAt") SELECT "id", "name", "description", "parentId", "managerId", "createdAt", "updatedAt" FROM `departments`;--> statement-breakpoint
DROP TABLE `departments`;--> statement-breakpoint
ALTER TABLE `__new_departments` RENAME TO `departments`;--> statement-breakpoint
CREATE UNIQUE INDEX `departments_name_unique` ON `departments` (`name`);