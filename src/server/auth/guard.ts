import "server-only";
import type { Database } from "../db/client";
import { ApiProblem } from "../http";
import { SESSION_COOKIE, SESSION_DAYS, readSession, type ActiveSession } from "./session";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index > 0 && part.slice(0, index).trim() === name) {
      try { return decodeURIComponent(part.slice(index + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

export const sessionToken = (request: Request) => readCookie(request, SESSION_COOKIE);

/** `__Host-` cookies must be Secure, Path=/ and host-only; browsers accept Secure on http://localhost. */
export function sessionCookie(token: string, maxAgeSeconds = SESSION_DAYS * 24 * 60 * 60): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`;
}
export const clearedSessionCookie = () => `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try { return new URL(url).origin; } catch { return null; }
}

/**
 * CSRF guard for state-changing requests: the browser's Origin must be this site. Cross-site pages cannot
 * forge Origin, and without CORS they cannot add custom headers or send JSON without a preflight.
 * With APP_URL configured (required in production) the full origin must match it exactly; only in
 * development without APP_URL is the Host header used.
 */
export function isSameOrigin(request: Request): boolean {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true;
  const origin = originOf(request.headers.get("origin") ?? undefined);
  if (!origin) return false;
  const configured = originOf(process.env.APP_URL);
  if (configured) return origin === configured;
  if (process.env.NODE_ENV === "production") return false;
  const host = request.headers.get("host");
  return Boolean(host) && new URL(origin).host === host;
}

export function assertSameOrigin(request: Request): void {
  if (!isSameOrigin(request)) throw new ApiProblem(403, "forbidden", "This request must come from the Heritg app.");
}

/** The signed-in owner, or a 401. State-changing requests must also pass the origin check. */
export async function requireOwner(request: Request, db: Database): Promise<ActiveSession> {
  assertSameOrigin(request);
  const session = await readSession(db, sessionToken(request));
  if (!session) throw new ApiProblem(401, "unauthenticated", "Sign in to continue.");
  return session;
}

/**
 * The client address for rate limiting, or null when it cannot be trusted. Clients can send any
 * X-Forwarded-For, so only hops appended by our own proxies count: TRUSTED_PROXY_HOPS=1 behind one
 * reverse proxy reads the right-most entry. With the default 0 the address is unknown (null).
 */
export function clientIp(request: Request): string | null {
  const hops = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "0", 10);
  if (!Number.isSafeInteger(hops) || hops <= 0) return null;
  const chain = (request.headers.get("x-forwarded-for") ?? "").split(",").map(part => part.trim()).filter(Boolean);
  const ip = chain[chain.length - hops];
  return ip ? ip.slice(0, 64) : null;
}
