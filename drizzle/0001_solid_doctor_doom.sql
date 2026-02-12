CREATE TABLE "generation_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workout_id" uuid,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"context_snapshot" jsonb NOT NULL,
	"model" text NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "training_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL,
	"source" text DEFAULT 'refinement' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "workout_sets" ADD COLUMN "rpe" double precision;--> statement-breakpoint
ALTER TABLE "generation_conversations" ADD CONSTRAINT "generation_conversations_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD CONSTRAINT "rpe_range" CHECK ("workout_sets"."rpe" is null or ("workout_sets"."rpe" >= 6 and "workout_sets"."rpe" <= 10));