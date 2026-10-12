import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db/client";
import { users } from "../db/schema";
import { ApiProblem, handle, json, readJson } from "../http";
import { assertSameOrigin, clearedSessionCookie, clientIp, requireOwner, sessionCookie, sessionToken } from "./guard";
import { hashPassword, passwordProblem, verifyPassword, PASSWORD_MAX } from "./password";
import { clearAfterSuccess, registerAttempt, withHashSlot } from "./rateLimit";
import { createSession, deleteSession, readSession, revokeOtherSessions, type SessionUser } from "./session";
import { findUserByEmail, normalizeEmail } from "./users";

const MAX_BODY = 4 * 1024;
const credentials = z.object({ email: z.string().max(254), password: z.string().max(PASSWORD_MAX) });
const passwordChange = z.object({ currentPassword: z.string().max(PASSWORD_MAX), newPassword: z.string().max(PASSWORD_MAX) });

/** The user as the browser sees it; `uid` keeps the shape the client already uses. */
export const publicUser = (user: SessionUser) => ({ uid: user.id, email: user.email, displayName: user.displayName });

const RATE_LIMITED = () => new ApiProblem(429, "rate-limited", "Too many attempts. Wait a moment and try again.");

/**
 * Check a password under the attempt limits: the attempt is recorded first (no race), a blocked
 * address/pair or an attempt that comes too soon after the account's recent failures is refused, and
 * hashing runs in a bounded pool. Returns the verdict and the attempt ids to clear on success.
 */
async function guardedVerify(db: Database, email: string, ip: string | null, stored: string | null, password: string): Promise<{ valid: boolean; attemptIds: number[] }> {
  const verdict = await registerAttempt(db, email, ip);
  if (verdict.blocked) throw RATE_LIMITED();
  const valid = await withHashSlot(() => verifyPassword(stored, password));
  if (valid === "busy") throw RATE_LIMITED();
  return { valid, attemptIds: verdict.attemptIds };
}

/** POST /api/auth/login — neutral errors, attempt limits, and a fresh session on every success. */
export function login(request: Request, db: Database): Promise<Response> {
  return handle(async () => {
    assertSameOrigin(request);
    const parsed = credentials.safeParse(await readJson(request, MAX_BODY));
    if (!parsed.success) throw new ApiProblem(400, "invalid", "Enter your email and password.");
    const email = normalizeEmail(parsed.data.email), ip = clientIp(request);
    const user = await findUserByEmail(db, email);
    const { valid, attemptIds } = await guardedVerify(db, email, ip, user?.passwordHash ?? null, parsed.data.password);
    if (!user || !valid) throw new ApiProblem(401, "invalid-credentials", "The email or password is incorrect.");
    await clearAfterSuccess(db, email, ip, attemptIds);
    await deleteSession(db, sessionToken(request));
    const { token } = await createSession(db, user.id, request.headers.get("user-agent") ?? "");
    return json({ user: publicUser({ id: user.id, email: user.email, displayName: user.displayName }) }, { headers: { "Set-Cookie": sessionCookie(token) } });
  });
}

/** POST /api/auth/logout — deletes the session and clears the cookie. */
export function logout(request: Request, db: Database): Promise<Response> {
  return handle(async () => {
    assertSameOrigin(request);
    await deleteSession(db, sessionToken(request));
    // Also drop cached private photos so the next person on a shared computer cannot see them.
    return json({ ok: true }, { headers: { "Set-Cookie": clearedSessionCookie(), "Clear-Site-Data": "\"cache\"" } });
  });
}

/** GET /api/auth/session — the signed-in user or null; the cookie is re-sent so it tracks the sliding expiry. */
export function session(request: Request, db: Database): Promise<Response> {
  return handle(async () => {
    const token = sessionToken(request);
    const active = await readSession(db, token);
    if (!active || !token) return json({ user: null }, token ? { headers: { "Set-Cookie": clearedSessionCookie() } } : {});
    const maxAge = (active.expiresAt.getTime() - Date.now()) / 1000;
    return json({ user: publicUser(active.user) }, { headers: { "Set-Cookie": sessionCookie(token, maxAge) } });
  });
}

/** POST /api/auth/password — change the password with the current one; other devices are signed out. */
export function changePassword(request: Request, db: Database): Promise<Response> {
  return handle(async () => {
    const active = await requireOwner(request, db);
    const parsed = passwordChange.safeParse(await readJson(request, MAX_BODY));
    if (!parsed.success) throw new ApiProblem(400, "invalid", "Enter your current and new password.");
    const problem = passwordProblem(parsed.data.newPassword);
    if (problem) throw new ApiProblem(400, "invalid", problem);
    const ip = clientIp(request);
    const [user] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, active.user.id)).limit(1);
    const { valid, attemptIds } = await guardedVerify(db, active.user.email, ip, user?.passwordHash ?? null, parsed.data.currentPassword);
    if (!valid) throw new ApiProblem(401, "invalid-credentials", "The current password is incorrect.");
    await clearAfterSuccess(db, active.user.email, ip, attemptIds);
    await db.update(users).set({ passwordHash: await hashPassword(parsed.data.newPassword), passwordChangedAt: new Date() }).where(eq(users.id, active.user.id));
    await revokeOtherSessions(db, active.user.id, active.tokenHash);
    return json({ ok: true });
  });
}
