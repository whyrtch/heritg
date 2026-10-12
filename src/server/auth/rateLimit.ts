import "server-only";
import { and, gte, inArray, lt, notInArray, or, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { loginAttempts } from "../db/schema";

export const WINDOW_MS = 15 * 60 * 1000;
/** Failures from one address against one account before that pair is blocked. */
export const MAX_FAILURES_PER_PAIR = 5;
/** Failures from one address across all accounts before the address is blocked. */
export const MAX_FAILURES_PER_IP = 20;
/** Failures against one account (from anywhere) before attempts on it must be spaced out. */
export const SLOWDOWN_AFTER = 5;
/** The required gap grows by a second per extra failure, up to this (≈ 90 attempts per 15 minutes). */
export const MAX_GAP_MS = 10_000;
const PURGE_EVERY_MS = 60_000;
let lastPurge = 0;

export const emailKey = (email: string) => `email:${email}`;
export const ipKey = (ip: string) => `ip:${ip}`;
export const pairKey = (email: string, ip: string) => `pair:${ip}|${email}`;

export type AttemptVerdict = { blocked: boolean; attemptIds: number[] };

/**
 * Record a login attempt *before* checking the password, then decide. Recording first means parallel
 * guesses all count against each other (no check-then-act race).
 *
 * A blocked pair or address cannot stop the owner signing in from elsewhere. Once an account has
 * failures from anywhere, attempts on it must be spaced out (1–10 s gap); an attempt that arrives
 * sooner — including one of many parallel requests — is refused. That caps guessing at roughly
 * 90 attempts per 15 minutes without a permanent lockout.
 * `ip` is null when the client address is unknown or untrusted; then only the account spacing applies.
 */
export async function registerAttempt(db: Database, email: string, ip: string | null, now = new Date()): Promise<AttemptVerdict> {
  const keys = ip ? [emailKey(email), ipKey(ip), pairKey(email, ip)] : [emailKey(email)];
  if (now.getTime() - lastPurge >= PURGE_EVERY_MS) { lastPurge = now.getTime(); await purgeOldAttempts(db, now); }
  const inserted = await db.insert(loginAttempts).values(keys.map(key => ({ key, attemptedAt: now }))).returning({ id: loginAttempts.id });
  const since = new Date(now.getTime() - WINDOW_MS);
  const ids = inserted.map(row => row.id);
  // latestBefore: the newest *other* attempt on the key, so parallel requests see each other.
  const rows = await db.select({ key: loginAttempts.key, count: sql<number>`count(*)::int`, latestBefore: sql<string | null>`max(${loginAttempts.attemptedAt}) filter (where ${notInArray(loginAttempts.id, ids)})` }).from(loginAttempts)
    .where(and(inArray(loginAttempts.key, keys), gte(loginAttempts.attemptedAt, since)))
    .groupBy(loginAttempts.key);
  // The attempt just recorded is still pending: limits apply to the attempts before it.
  const previous = (key: string) => Math.max(0, (rows.find(row => row.key === key)?.count ?? 0) - 1);
  const addressBlocked = ip !== null && (previous(pairKey(email, ip)) >= MAX_FAILURES_PER_PAIR || previous(ipKey(ip)) >= MAX_FAILURES_PER_IP);
  const accountFailures = previous(emailKey(email));
  const gapMs = accountFailures >= SLOWDOWN_AFTER ? Math.min(MAX_GAP_MS, 1000 * (accountFailures - SLOWDOWN_AFTER + 1)) : 0;
  const latest = rows.find(row => row.key === emailKey(email))?.latestBefore;
  const tooSoon = gapMs > 0 && latest !== null && latest !== undefined && now.getTime() - new Date(latest).getTime() < gapMs;
  return { blocked: addressBlocked || tooSoon, attemptIds: ids };
}

/** After a successful login: drop this attempt's rows and the account's earlier failures (the address keeps its other failures). */
export async function clearAfterSuccess(db: Database, email: string, ip: string | null, attemptIds: number[]): Promise<void> {
  const keys = ip ? [emailKey(email), pairKey(email, ip)] : [emailKey(email)];
  await db.delete(loginAttempts).where(attemptIds.length ? or(inArray(loginAttempts.key, keys), inArray(loginAttempts.id, attemptIds)) : inArray(loginAttempts.key, keys));
}

export async function purgeOldAttempts(db: Database, now = new Date()): Promise<void> {
  await db.delete(loginAttempts).where(lt(loginAttempts.attemptedAt, new Date(now.getTime() - WINDOW_MS)));
}

/**
 * Argon2id uses ~19 MiB per hash; cap concurrent hashing so a flood of logins cannot exhaust memory.
 * Requests beyond the queue limit are refused instead of waiting.
 */
const MAX_CONCURRENT_HASHES = 4, MAX_QUEUE = 32;
let running = 0;
const queue: (() => void)[] = [];
export async function withHashSlot<T>(work: () => Promise<T>): Promise<T | "busy"> {
  if (running >= MAX_CONCURRENT_HASHES) {
    if (queue.length >= MAX_QUEUE) return "busy";
    // The finishing request hands its slot straight to us, so `running` is not incremented again.
    await new Promise<void>(resolve => queue.push(resolve));
  } else {
    running += 1;
  }
  try {
    return await work();
  } finally {
    const next = queue.shift();
    if (next) next();
    else running -= 1;
  }
}
