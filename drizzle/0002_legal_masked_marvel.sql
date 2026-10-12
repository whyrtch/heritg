ALTER TABLE "publications" ADD COLUMN "encrypted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "publications" ADD COLUMN "ciphertext" text;--> statement-breakpoint
ALTER TABLE "publications" ADD COLUMN "crypto" jsonb;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_encrypted_check" CHECK (("publications"."encrypted" and "publications"."ciphertext" is not null and "publications"."crypto" is not null and jsonb_typeof("publications"."crypto") = 'object' and "publications"."snapshot" = '{}'::jsonb)
    or (not "publications"."encrypted" and "publications"."ciphertext" is null and "publications"."crypto" is null));--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_ciphertext_size_check" CHECK ("publications"."ciphertext" is null or char_length("publications"."ciphertext") <= 4000000);