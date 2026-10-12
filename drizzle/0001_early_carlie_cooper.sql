ALTER TABLE "publications" ADD COLUMN "options" jsonb DEFAULT '{"dates":true,"marriageDates":true,"photos":true}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "publications" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_options_check" CHECK (jsonb_typeof("publications"."options") = 'object');