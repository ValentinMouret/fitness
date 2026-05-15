CREATE TABLE "daily_note" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"updated_at" timestamp
);
