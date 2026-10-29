CREATE TABLE `attendance_store` (
	`id` integer PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL
);
