CREATE TABLE "login_attempts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people" (
	"tree_id" text NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"gender" text NOT NULL,
	"birth_date" text DEFAULT '' NOT NULL,
	"death_date" text DEFAULT '' NOT NULL,
	"birth_order" integer,
	"residence" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"photo_url" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "people_tree_id_id_pk" PRIMARY KEY("tree_id","id"),
	CONSTRAINT "people_id_check" CHECK (char_length("people"."id") between 1 and 128),
	CONSTRAINT "people_name_check" CHECK (char_length("people"."name") between 1 and 120),
	CONSTRAINT "people_gender_check" CHECK ("people"."gender" in ('female', 'male', 'unspecified')),
	CONSTRAINT "people_birth_date_check" CHECK ("people"."birth_date" ~ '^([0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01]))?$'),
	CONSTRAINT "people_death_date_check" CHECK ("people"."death_date" ~ '^([0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01]))?$'),
	CONSTRAINT "people_birth_order_check" CHECK ("people"."birth_order" is null or "people"."birth_order" between 1 and 99),
	CONSTRAINT "people_residence_check" CHECK (char_length("people"."residence") <= 120),
	CONSTRAINT "people_notes_check" CHECK (char_length("people"."notes") <= 10000),
	CONSTRAINT "people_photo_url_check" CHECK (char_length("people"."photo_url") <= 2048 and ("people"."photo_url" = '' or "people"."photo_url" ~ '^https://[^[:space:]]+$')),
	CONSTRAINT "people_sort_order_check" CHECK ("people"."sort_order" between 0 and 1000000)
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"tree_id" text NOT NULL,
	"person_id" text NOT NULL,
	"mime" text NOT NULL,
	"bytes" "bytea" NOT NULL,
	"sha256" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photos_tree_id_person_id_pk" PRIMARY KEY("tree_id","person_id"),
	CONSTRAINT "photos_mime_check" CHECK ("photos"."mime" in ('image/jpeg', 'image/webp')),
	CONSTRAINT "photos_size_check" CHECK (octet_length("bytes") between 1 and 49152),
	CONSTRAINT "photos_sha256_check" CHECK ("photos"."sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "public_photos" (
	"public_id" text NOT NULL,
	"person_id" text NOT NULL,
	"mime" text NOT NULL,
	"bytes" "bytea" NOT NULL,
	"sha256" text NOT NULL,
	CONSTRAINT "public_photos_public_id_person_id_pk" PRIMARY KEY("public_id","person_id"),
	CONSTRAINT "public_photos_mime_check" CHECK ("public_photos"."mime" in ('image/jpeg', 'image/webp')),
	CONSTRAINT "public_photos_size_check" CHECK (octet_length("bytes") between 1 and 49152)
);
--> statement-breakpoint
CREATE TABLE "publications" (
	"public_id" text PRIMARY KEY NOT NULL,
	"tree_id" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"name" text NOT NULL,
	"schema_version" integer NOT NULL,
	"published_revision" integer NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "publications_public_id_check" CHECK ("publications"."public_id" ~ '^[A-Za-z0-9_-]{20,128}$'),
	CONSTRAINT "publications_name_check" CHECK (char_length("publications"."name") between 1 and 120),
	CONSTRAINT "publications_revision_check" CHECK ("publications"."published_revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE "relationships" (
	"tree_id" text NOT NULL,
	"id" text NOT NULL,
	"type" text NOT NULL,
	"from_person_id" text NOT NULL,
	"to_person_id" text NOT NULL,
	"kind" text,
	"status" text,
	"married_on" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "relationships_tree_id_id_pk" PRIMARY KEY("tree_id","id"),
	CONSTRAINT "relationships_id_check" CHECK (char_length("relationships"."id") between 1 and 128),
	CONSTRAINT "relationships_not_self_check" CHECK ("relationships"."from_person_id" <> "relationships"."to_person_id"),
	CONSTRAINT "relationships_details_check" CHECK (("relationships"."type" = 'parent-child' and "relationships"."kind" is not null and "relationships"."kind" in ('biological', 'step', 'adoptive', 'foster', 'guardian') and "relationships"."status" is null and "relationships"."married_on" = '')
    or ("relationships"."type" = 'partner' and "relationships"."kind" is null and "relationships"."status" is not null and "relationships"."status" in ('married', 'partner', 'ex') and "relationships"."married_on" ~ '^([0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01]))?$'))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" "bytea" PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text DEFAULT '' NOT NULL,
	CONSTRAINT "sessions_token_hash_check" CHECK (octet_length("sessions"."token_hash") = 32),
	CONSTRAINT "sessions_user_agent_check" CHECK (char_length("sessions"."user_agent") <= 512)
);
--> statement-breakpoint
CREATE TABLE "trees" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"schema_version" integer NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"public_id" text,
	"published_revision" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trees_id_check" CHECK (char_length("trees"."id") between 1 and 128),
	CONSTRAINT "trees_name_check" CHECK (char_length("trees"."name") between 1 and 120),
	CONSTRAINT "trees_revision_check" CHECK ("trees"."revision" >= 0),
	CONSTRAINT "trees_schema_version_check" CHECK ("trees"."schema_version" between 1 and 10),
	CONSTRAINT "trees_publication_check" CHECK (("trees"."visibility" = 'private' and "trees"."public_id" is null and "trees"."published_revision" is null)
    or ("trees"."visibility" = 'unlisted' and "trees"."public_id" is not null and "trees"."published_revision" is not null and "trees"."published_revision" between 0 and "trees"."revision"))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"password_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_check" CHECK ("users"."email" = lower("users"."email") and char_length("users"."email") between 3 and 254 and "users"."email" like '%_@_%'),
	CONSTRAINT "users_display_name_check" CHECK (char_length("users"."display_name") <= 120)
);
--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_tree_id_trees_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."trees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_person_fk" FOREIGN KEY ("tree_id","person_id") REFERENCES "public"."people"("tree_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_photos" ADD CONSTRAINT "public_photos_public_id_publications_public_id_fk" FOREIGN KEY ("public_id") REFERENCES "public"."publications"("public_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_tree_id_trees_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."trees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_tree_id_trees_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."trees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_from_person_fk" FOREIGN KEY ("tree_id","from_person_id") REFERENCES "public"."people"("tree_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_to_person_fk" FOREIGN KEY ("tree_id","to_person_id") REFERENCES "public"."people"("tree_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trees" ADD CONSTRAINT "trees_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "login_attempts_key_idx" ON "login_attempts" USING btree ("key","attempted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "publications_tree_key" ON "publications" USING btree ("tree_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "trees_owner_idx" ON "trees" USING btree ("owner_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "trees_public_id_key" ON "trees" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");