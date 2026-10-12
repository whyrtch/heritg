import "server-only";
import { hash, verify } from "@node-rs/argon2";

export const PASSWORD_MIN = 12, PASSWORD_MAX = 256;

// OWASP-recommended Argon2id parameters (19 MiB, 2 iterations, 1 lane).
// `Algorithm` is a const enum (not usable with isolatedModules); 2 is Algorithm.Argon2id.
const OPTIONS = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;
  return null;
}

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

let dummy: Promise<string> | null = null;

/**
 * Verify a password. With no stored hash (unknown email) a dummy hash is still checked, so an
 * attacker cannot tell from the response time whether an account exists.
 */
export async function verifyPassword(stored: string | null, password: string): Promise<boolean> {
  if (!stored) {
    dummy ??= hashPassword("heritg-dummy-password-for-timing");
    await verify(await dummy, password).catch(() => false);
    return false;
  }
  try {
    return await verify(stored, password);
  } catch {
    return false;
  }
}
