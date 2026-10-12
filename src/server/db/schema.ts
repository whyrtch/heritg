import { sql } from "drizzle-orm";
import { bigserial, boolean, check, customType, foreignKey, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * PostgreSQL schema. The CHECK constraints mirror the domain limits (src/features/tree/model.ts,
 * domain/photoData.ts) and are the second line of defence behind the API's Zod validation.
 * Owner scoping is enforced in src/server/** queries; foreign keys keep every child inside its tree.
 */

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({ dataType: () => "bytea" });
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

const ISO_DATE_OR_EMPTY = sql.raw(`'^([0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01]))?$'`);
/** Uploaded thumbnails: ≤ 48 KB of JPEG/WebP bytes. Keep in sync with PHOTO_MAX_BYTES. */
export const PHOTO_MAX_BYTES = 49152;

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull().default(""),
  createdAt: createdAt(),
  passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("users_email_key").on(table.email),
  check("users_email_check", sql`${table.email} = lower(${table.email}) and char_length(${table.email}) between 3 and 254 and ${table.email} like '%_@_%'`),
  check("users_display_name_check", sql`char_length(${table.displayName}) <= 120`),
]);

export const sessions = pgTable("sessions", {
  /** SHA-256 of the random cookie token; the token itself is never stored. */
  tokenHash: bytea("token_hash").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  userAgent: text("user_agent").notNull().default(""),
}, table => [
  index("sessions_user_idx").on(table.userId),
  index("sessions_expires_idx").on(table.expiresAt),
  check("sessions_token_hash_check", sql`octet_length(${table.tokenHash}) = 32`),
  check("sessions_user_agent_check", sql`char_length(${table.userAgent}) <= 512`),
]);

export const loginAttempts = pgTable("login_attempts", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  /** "email:<address>" or "ip:<address>". */
  key: text("key").notNull(),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [index("login_attempts_key_idx").on(table.key, table.attemptedAt)]);

export const trees = pgTable("trees", {
  /** Client-generated id (the same id the browser cache uses). */
  id: text("id").primaryKey(),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  revision: integer("revision").notNull().default(0),
  schemaVersion: integer("schema_version").notNull(),
  visibility: text("visibility", { enum: ["private", "unlisted"] }).notNull().default("private"),
  publicId: text("public_id"),
  publishedRevision: integer("published_revision"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, table => [
  index("trees_owner_idx").on(table.ownerId, table.updatedAt),
  uniqueIndex("trees_public_id_key").on(table.publicId),
  check("trees_id_check", sql`char_length(${table.id}) between 1 and 128`),
  check("trees_name_check", sql`char_length(${table.name}) between 1 and 120`),
  check("trees_revision_check", sql`${table.revision} >= 0`),
  check("trees_schema_version_check", sql`${table.schemaVersion} between 1 and 10`),
  check("trees_publication_check", sql`(${table.visibility} = 'private' and ${table.publicId} is null and ${table.publishedRevision} is null)
    or (${table.visibility} = 'unlisted' and ${table.publicId} is not null and ${table.publishedRevision} is not null and ${table.publishedRevision} between 0 and ${table.revision})`),
]);

export const people = pgTable("people", {
  treeId: text("tree_id").notNull().references(() => trees.id, { onDelete: "cascade" }),
  id: text("id").notNull(),
  name: text("name").notNull(),
  gender: text("gender", { enum: ["female", "male", "unspecified"] }).notNull(),
  birthDate: text("birth_date").notNull().default(""),
  deathDate: text("death_date").notNull().default(""),
  birthOrder: integer("birth_order"),
  residence: text("residence").notNull().default(""),
  notes: text("notes").notNull().default(""),
  photoUrl: text("photo_url").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: updatedAt(),
}, table => [
  primaryKey({ columns: [table.treeId, table.id] }),
  check("people_id_check", sql`char_length(${table.id}) between 1 and 128`),
  check("people_name_check", sql`char_length(${table.name}) between 1 and 120`),
  check("people_gender_check", sql`${table.gender} in ('female', 'male', 'unspecified')`),
  check("people_birth_date_check", sql`${table.birthDate} ~ ${ISO_DATE_OR_EMPTY}`),
  check("people_death_date_check", sql`${table.deathDate} ~ ${ISO_DATE_OR_EMPTY}`),
  check("people_birth_order_check", sql`${table.birthOrder} is null or ${table.birthOrder} between 1 and 99`),
  check("people_residence_check", sql`char_length(${table.residence}) <= 120`),
  check("people_notes_check", sql`char_length(${table.notes}) <= 10000`),
  check("people_photo_url_check", sql`char_length(${table.photoUrl}) <= 2048 and (${table.photoUrl} = '' or ${table.photoUrl} ~ '^https://[^[:space:]]+$')`),
  check("people_sort_order_check", sql`${table.sortOrder} between 0 and 1000000`),
]);

export const relationships = pgTable("relationships", {
  treeId: text("tree_id").notNull().references(() => trees.id, { onDelete: "cascade" }),
  id: text("id").notNull(),
  type: text("type", { enum: ["parent-child", "partner"] }).notNull(),
  fromPersonId: text("from_person_id").notNull(),
  toPersonId: text("to_person_id").notNull(),
  kind: text("kind", { enum: ["biological", "step", "adoptive", "foster", "guardian"] }),
  status: text("status", { enum: ["married", "partner", "ex"] }),
  marriedOn: text("married_on").notNull().default(""),
  updatedAt: updatedAt(),
}, table => [
  primaryKey({ columns: [table.treeId, table.id] }),
  // Both ends must be people of the same tree; deleting a person removes their lines.
  foreignKey({ name: "relationships_from_person_fk", columns: [table.treeId, table.fromPersonId], foreignColumns: [people.treeId, people.id] }).onDelete("cascade"),
  foreignKey({ name: "relationships_to_person_fk", columns: [table.treeId, table.toPersonId], foreignColumns: [people.treeId, people.id] }).onDelete("cascade"),
  // NULL in (...) is NULL, which a CHECK accepts — hence the explicit "is not null" below.
  check("relationships_id_check", sql`char_length(${table.id}) between 1 and 128`),
  check("relationships_not_self_check", sql`${table.fromPersonId} <> ${table.toPersonId}`),
  check("relationships_details_check", sql`(${table.type} = 'parent-child' and ${table.kind} is not null and ${table.kind} in ('biological', 'step', 'adoptive', 'foster', 'guardian') and ${table.status} is null and ${table.marriedOn} = '')
    or (${table.type} = 'partner' and ${table.kind} is null and ${table.status} is not null and ${table.status} in ('married', 'partner', 'ex') and ${table.marriedOn} ~ ${ISO_DATE_OR_EMPTY})`),
]);

export const photos = pgTable("photos", {
  treeId: text("tree_id").notNull(),
  personId: text("person_id").notNull(),
  mime: text("mime", { enum: ["image/jpeg", "image/webp"] }).notNull(),
  bytes: bytea("bytes").notNull(),
  sha256: text("sha256").notNull(),
  updatedAt: updatedAt(),
}, table => [
  primaryKey({ columns: [table.treeId, table.personId] }),
  foreignKey({ name: "photos_person_fk", columns: [table.treeId, table.personId], foreignColumns: [people.treeId, people.id] }).onDelete("cascade"),
  check("photos_mime_check", sql`${table.mime} in ('image/jpeg', 'image/webp')`),
  check("photos_size_check", sql.raw(`octet_length("bytes") between 1 and ${PHOTO_MAX_BYTES}`)),
  check("photos_sha256_check", sql`${table.sha256} ~ '^[0-9a-f]{64}$'`),
]);

/** An unlisted, read-only copy of a tree. It holds no owner identity; disabling the link deletes the row. */
export const publications = pgTable("publications", {
  publicId: text("public_id").primaryKey(),
  treeId: text("tree_id").notNull().references(() => trees.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(true),
  name: text("name").notNull(),
  schemaVersion: integer("schema_version").notNull(),
  publishedRevision: integer("published_revision").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  /** { people: OnlinePerson[], relationships: OnlineRelationship[] } without owner data. */
  snapshot: jsonb("snapshot").notNull(),
  /** What the link shows: { dates, marriageDates, photos }. The snapshot is already filtered; this is kept so the owner's UI can show it. */
  options: jsonb("options").notNull().default(sql`'{"dates":true,"marriageDates":true,"photos":true}'::jsonb`),
  /** The link stops working at this moment (checked in SQL on every public read); null = never. */
  expiresAt: timestamp("expires_at", { withTimezone: true }),
}, table => [
  uniqueIndex("publications_tree_key").on(table.treeId),
  check("publications_public_id_check", sql`${table.publicId} ~ '^[A-Za-z0-9_-]{20,128}$'`),
  check("publications_name_check", sql`char_length(${table.name}) between 1 and 120`),
  check("publications_revision_check", sql`${table.publishedRevision} >= 0`),
  check("publications_options_check", sql`jsonb_typeof(${table.options}) = 'object'`),
]);

export const publicPhotos = pgTable("public_photos", {
  publicId: text("public_id").notNull().references(() => publications.publicId, { onDelete: "cascade" }),
  personId: text("person_id").notNull(),
  mime: text("mime", { enum: ["image/jpeg", "image/webp"] }).notNull(),
  bytes: bytea("bytes").notNull(),
  sha256: text("sha256").notNull(),
}, table => [
  primaryKey({ columns: [table.publicId, table.personId] }),
  check("public_photos_mime_check", sql`${table.mime} in ('image/jpeg', 'image/webp')`),
  check("public_photos_size_check", sql.raw(`octet_length("bytes") between 1 and ${PHOTO_MAX_BYTES}`)),
]);
