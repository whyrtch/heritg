import "server-only";
import { eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { users } from "../db/schema";
import { hashPassword, passwordProblem } from "./password";
import { revokeAllSessions } from "./session";

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export class AccountError extends Error {}

export async function findUserByEmail(db: Database, email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, normalizeEmail(email))).limit(1);
  return user ?? null;
}

/** Create the archive owner (CLI only; there is no public registration). */
export async function createOwner(db: Database, email: string, password: string, displayName = ""): Promise<{ id: string; email: string }> {
  const normalized = normalizeEmail(email);
  if (!EMAIL.test(normalized) || normalized.length > 254) throw new AccountError("Enter a valid email address.");
  const problem = passwordProblem(password);
  if (problem) throw new AccountError(problem);
  if (await findUserByEmail(db, normalized)) throw new AccountError("An account with this email already exists.");
  const [user] = await db.insert(users).values({ email: normalized, passwordHash: await hashPassword(password), displayName: displayName.trim().slice(0, 120) }).returning({ id: users.id, email: users.email });
  return user;
}

/** Set a new password and sign the account out everywhere. */
export async function setPassword(db: Database, userId: string, password: string): Promise<void> {
  const problem = passwordProblem(password);
  if (problem) throw new AccountError(problem);
  await db.update(users).set({ passwordHash: await hashPassword(password), passwordChangedAt: new Date() }).where(eq(users.id, userId));
  await revokeAllSessions(db, userId);
}
