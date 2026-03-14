ALTER TABLE "habits" ADD COLUMN "identity_phrase" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN "time_of_day" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN "location" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN "is_keystone" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN "minimal_version" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN "color" text DEFAULT '#e15a46' NOT NULL;