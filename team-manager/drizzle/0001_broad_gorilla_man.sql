CREATE TABLE `departmentAssignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`teamMemberId` integer NOT NULL,
	`departmentId` integer NOT NULL,
	`assignedAt` integer NOT NULL,
	`assignedBy` integer,
	`isActive` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`teamMemberId`) REFERENCES `teamMembers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assignedBy`) REFERENCES `teamMembers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `departments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`parentId` integer,
	`managerId` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`parentId`) REFERENCES `departments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`managerId`) REFERENCES `teamMembers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `departments_name_unique` ON `departments` (`name`);