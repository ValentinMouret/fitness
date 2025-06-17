CREATE TABLE "habit_completions" (
	"habit_id" uuid NOT NULL,
	"completion_date" date NOT NULL,
	"completed" boolean NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	CONSTRAINT "habit_completions_habit_id_completion_date_pk" PRIMARY KEY("habit_id","completion_date")
);
--> statement-breakpoint
CREATE TABLE "habits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"frequency_type" text NOT NULL,
	"frequency_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"target_count" integer DEFAULT 1 NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "measurements" (
	"name" text PRIMARY KEY NOT NULL,
	"unit" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "measures" (
	"measurement_name" text NOT NULL,
	"t" timestamp DEFAULT now() NOT NULL,
	"value" double precision NOT NULL,
	CONSTRAINT "measures_measurement_name_t_pk" PRIMARY KEY("measurement_name","t")
);
--> statement-breakpoint
ALTER TABLE "habit_completions" ADD CONSTRAINT "habit_completions_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measures" ADD CONSTRAINT "measures_measurement_name_measurements_name_fk" FOREIGN KEY ("measurement_name") REFERENCES "public"."measurements"("name") ON DELETE no action ON UPDATE no action;