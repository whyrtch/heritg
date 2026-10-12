import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, lt, ne } from "drizzle-orm";
import type { Database } from "../db/client";
import { sessions, users } from "../db/schema";

export const SESSION_COOKIE = "__Host-heritg_session";
export const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;
/** However active, a session ends this long after sign-in. */
export const SESSION_MAX_DAYS = 90;
const SESSION_MAX_MS = SESSION_MAX_DAYS * 24 * 60 * 60 * 1000;
/** Sliding expiry is written at most once an hour per session. */
const TOUCH_MS = 60 * 60 * 1000;

export type SessionUser = { id: string; email: string; displayName: string };
export type ActiveSession = { user: SessionUser; tokenHash: Uint8Array; expiresAt: Date; refreshed: boolean };

const sha256 = (token: string) => new Uint8Array(createHash("sha256").update(token).digest());

/** Create a session and return the raw token for the cookie (only its hash is stored). */
export async function createSession(db: Database, userId: string, userAgent = "", now = new Date()): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_MS);
  await db.insert(sessions).values({ tokenHash: sha256(token), userId, createdAt: now, lastSeenAt: now, expiresAt, userAgent: userAgent.slice(0, 512) });
  // Housekeeping: drop expired sessions of everyone while we are here.
  await db.delete(sessions).where(lt(sessions.expiresAt, now));
  return { token, expiresAt };
}

/** Resolve a cookie token to its user. Expired or unknown tokens return null; active ones slide forward. */
export async function readSession(db: Database, token: string | undefined | null, now = new Date()): Promise<ActiveSession | null> {
  if (!token || token.length > 200) return null;
  const tokenHash = sha256(token);
  const [row] = await db.select({ userId: sessions.userId, createdAt: sessions.createdAt, expiresAt: sessions.expiresAt, lastSeenAt: sessions.lastSeenAt, email: users.email, displayName: users.displayName })
    .from(sessions).innerJoin(users, eq(users.id, sessions.userId)).where(eq(sessions.tokenHash, tokenHash)).limit(1);
  if (!row) return null;
  if (row.expiresAt <= now || now.getTime() - row.createdAt.getTime() >= SESSION_MAX_MS) {
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    return null;
  }
  let expiresAt = row.expiresAt, refreshed = false;
  if (now.getTime() - row.lastSeenAt.getTime() >= TOUCH_MS) {
    expiresAt = new Date(Math.min(now.getTime() + SESSION_MS, row.createdAt.getTime() + SESSION_MAX_MS));
    refreshed = true;
    await db.update(sessions).set({ lastSeenAt: now, expiresAt }).where(eq(sessions.tokenHash, tokenHash));
  }
  return { user: { id: row.userId, email: row.email, displayName: row.displayName }, tokenHash, expiresAt, refreshed };
}

export async function deleteSession(db: Database, token: string | undefined | null): Promise<void> {
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
}

/** Sign out every other device of this user (after a password change). */
export async function revokeOtherSessions(db: Database, userId: string, keep: Uint8Array): Promise<void> {
  await db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.tokenHash, keep)));
}

export async function revokeAllSessions(db: Database, userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
