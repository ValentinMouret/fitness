ALTER TABLE "exercises" ADD COLUMN "mmc_instructions" text;--> statement-breakpoint
ALTER TABLE "workouts" ADD COLUMN "imported_from_fitbod" boolean DEFAULT false NOT NULL;