import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { changePassword, login, logout, session } from "@/server/auth/handlers";
import { registerAttempt } from "@/server/auth/rateLimit";
import { readSession, createSession } from "@/server/auth/session";
import { loginAttempts } from "@/server/db/schema";
import { AccountError, createOwner, setPassword } from "@/server/auth/users";
import { sessions, users } from "@/server/db/schema";
import { createTestDb, type TestDb } from "./db";

const ORIGIN = "http://localhost:3000";
const EMAIL = "owner@heritg.test", PASSWORD = "correct horse battery";
let t: TestDb;

type Options = { body?: unknown; cookie?: string; origin?: string | null; ip?: string; contentType?: string };
function request(method: string, path: string, { body, cookie, origin = ORIGIN, ip = "203.0.113.7", contentType = "application/json" }: Options = {}): Request {
  const headers = new Headers({ host: "localhost:3000", "x-forwarded-for": ip });
  if (origin) headers.set("origin", origin);
  if (cookie) headers.set("cookie", cookie);
  if (body !== undefined) headers.set("content-type", contentType);
  return new Request(`${ORIGIN}${path}`, { method, headers, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
}
const cookieFrom = (response: Response) => (response.headers.get("set-cookie") ?? "").split(";")[0];
const signIn = (password = PASSWORD, options: Options = {}) => login(request("POST", "/api/auth/login", { body: { email: EMAIL, password }, ...options }), t.db);

beforeAll(async () => {
  process.env.APP_URL = ORIGIN;
  // Behind one trusted proxy: the right-most X-Forwarded-For entry is the client address.
  process.env.TRUSTED_PROXY_HOPS = "1";
  t = await createTestDb();
});
afterAll(async () => { await t.close(); });
beforeEach(async () => {
  await t.client.exec("truncate users, login_attempts cascade");
  process.env.TRUSTED_PROXY_HOPS = "1";
  await createOwner(t.db, " Owner@Heritg.test ", PASSWORD, "Pemilik");
});

describe("owner accounts", () => {
  it("stores an Argon2id hash and a lowercase email", async () => {
    const [user] = await t.db.select().from(users);
    expect(user.email).toBe(EMAIL);
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.passwordHash).not.toContain(PASSWORD);
  });

  it("rejects weak passwords, bad emails and duplicates", async () => {
    await expect(createOwner(t.db, "other@heritg.test", "short")).rejects.toBeInstanceOf(AccountError);
    await expect(createOwner(t.db, "not-an-email", PASSWORD)).rejects.toThrow(/valid email/);
    await expect(createOwner(t.db, EMAIL.toUpperCase(), PASSWORD)).rejects.toThrow(/already exists/);
  });
});

describe("login", () => {
  it("signs in with a secure host-only session cookie", async () => {
    const response = await signIn();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ user: { email: EMAIL, displayName: "Pemilik", uid: expect.any(String) } });
    const header = response.headers.get("set-cookie")!;
    expect(header).toMatch(/^__Host-heritg_session=[A-Za-z0-9_-]{43};/);
    for (const flag of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/", "Max-Age=2592000"]) expect(header).toContain(flag);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const me = await session(request("GET", "/api/auth/session", { cookie: cookieFrom(response) }), t.db);
    expect(await me.json()).toMatchObject({ user: { email: EMAIL } });
    // /session always re-sends the cookie so its lifetime follows the sliding server expiry.
    expect(me.headers.get("set-cookie")).toMatch(/Max-Age=259\d{4}/);
  });

  it("stores only a hash of the session token", async () => {
    const token = cookieFrom(await signIn()).split("=")[1];
    const [row] = await t.db.select().from(sessions);
    expect(Buffer.from(row.tokenHash).toString("base64url")).not.toBe(token);
    expect(row.tokenHash).toHaveLength(32);
  });

  it("answers a wrong password and an unknown email identically", async () => {
    const wrong = await signIn("wrong password here");
    const unknown = await login(request("POST", "/api/auth/login", { body: { email: "nobody@heritg.test", password: PASSWORD } }), t.db);
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await wrong.json()).toEqual(await unknown.json());
    expect(wrong.headers.get("set-cookie")).toBeNull();
  });

  it("blocks one address after five failures on an account, without a permanent lockout", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) expect((await signIn("wrong password here", { ip: "198.51.100.9" })).status).toBe(401);
    const blocked = await signIn(PASSWORD, { ip: "198.51.100.9" });
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({ error: { code: "rate-limited" } });
    // From another address the owner is only asked to wait a moment, never locked out.
    const later = new Date(Date.now() + 2_000);
    expect((await registerAttempt(t.db, EMAIL, "203.0.113.200", later)).blocked).toBe(false);
  });

  it("spaces out attempts on an account after failures, including parallel ones", async () => {
    const at = (seconds: number) => new Date(Date.UTC(2026, 0, 1, 12, 0, seconds));
    for (let attempt = 0; attempt < 5; attempt += 1) expect((await registerAttempt(t.db, EMAIL, `198.51.100.${attempt}`, at(attempt))).blocked).toBe(false);
    // Five failures: the next attempt needs a 1 s gap after the last one (at 4 s).
    expect((await registerAttempt(t.db, EMAIL, "198.51.100.50", at(4))).blocked).toBe(true);
    // That refused attempt still counts, so the gap grows to 2 s.
    expect((await registerAttempt(t.db, EMAIL, "198.51.100.51", at(5))).blocked).toBe(true);
    expect((await registerAttempt(t.db, EMAIL, "198.51.100.52", at(8))).blocked).toBe(false);
    const burst = await Promise.all(Array.from({ length: 8 }, (_, index) => registerAttempt(t.db, EMAIL, `198.51.101.${index}`, at(20))));
    expect(burst.filter(result => !result.blocked).length).toBeLessThanOrEqual(1);
  });

  it("limits one address that tries many accounts", async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) await login(request("POST", "/api/auth/login", { body: { email: `guess${attempt}@heritg.test`, password: "whatever password" }, ip: "192.0.2.50" }), t.db);
    expect((await signIn(PASSWORD, { ip: "192.0.2.50" })).status).toBe(429);
    expect((await signIn(PASSWORD, { ip: "192.0.2.51" })).status).toBe(200);
  });

  it("counts parallel guesses before checking them", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => signIn("wrong password here", { ip: "198.51.100.77" })));
    expect(results.every(result => result.status === 401 || result.status === 429)).toBe(true);
    expect((await signIn(PASSWORD, { ip: "198.51.100.77" })).status).toBe(429);
  });

  it("ignores client-supplied X-Forwarded-For unless a proxy is trusted", async () => {
    process.env.TRUSTED_PROXY_HOPS = "0";
    for (let attempt = 0; attempt < 6; attempt += 1) await signIn("wrong password here", { ip: `10.0.0.${attempt}` });
    // Only account keys were recorded: the spoofed addresses were not trusted.
    expect((await t.db.select().from(loginAttempts)).every(row => row.key.startsWith("email:"))).toBe(true);
    expect((await registerAttempt(t.db, EMAIL, null, new Date(Date.now() + 20_000))).blocked).toBe(false);
  });

  it("never buffers an oversized chunked body", async () => {
    const big = new TextEncoder().encode(JSON.stringify({ email: EMAIL, password: "x".repeat(10_000) }));
    const body = new ReadableStream({ start(controller) { for (let i = 0; i < big.length; i += 1024) controller.enqueue(big.slice(i, i + 1024)); controller.close(); } });
    const chunked = new Request(`${ORIGIN}/api/auth/login`, { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json" }, body, duplex: "half" } as RequestInit);
    expect((await login(chunked, t.db)).status).toBe(413);
  });

  it("requires the exact configured origin, scheme included", async () => {
    expect((await signIn(PASSWORD, { origin: "https://localhost:3000" })).status).toBe(403);
  });

  it("treats a malformed cookie as signed out instead of failing", async () => {
    const response = await session(request("GET", "/api/auth/session", { cookie: "__Host-heritg_session=%E0%A4%A" }), t.db);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ user: null });
  });

  it("rejects cross-site and origin-less logins, and non-JSON bodies", async () => {
    expect((await signIn(PASSWORD, { origin: "https://evil.example" })).status).toBe(403);
    expect((await signIn(PASSWORD, { origin: null })).status).toBe(403);
    expect((await login(request("POST", "/api/auth/login", { body: `email=${EMAIL}`, contentType: "application/x-www-form-urlencoded" }), t.db)).status).toBe(415);
    expect((await login(request("POST", "/api/auth/login", { body: "{not json" }), t.db)).status).toBe(400);
    expect((await login(request("POST", "/api/auth/login", { body: { email: EMAIL, password: "x".repeat(5000) } }), t.db)).status).toBe(413);
  });

  it("rotates the session: an old cookie stops working after a new login", async () => {
    const first = cookieFrom(await signIn());
    const second = await signIn(PASSWORD, { cookie: first });
    expect(cookieFrom(second)).not.toBe(first);
    expect(await (await session(request("GET", "/api/auth/session", { cookie: first }), t.db)).json()).toEqual({ user: null });
  });
});

describe("sessions", () => {
  it("logs out by deleting the session and clearing the cookie", async () => {
    const cookie = cookieFrom(await signIn());
    const response = await logout(request("POST", "/api/auth/logout", { cookie, body: {} }), t.db);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(await (await session(request("GET", "/api/auth/session", { cookie }), t.db)).json()).toEqual({ user: null });
    expect(await t.db.select().from(sessions)).toHaveLength(0);
  });

  it("refuses a cross-site logout", async () => {
    const cookie = cookieFrom(await signIn());
    expect((await logout(request("POST", "/api/auth/logout", { cookie, origin: "https://evil.example", body: {} }), t.db)).status).toBe(403);
    expect(await t.db.select().from(sessions)).toHaveLength(1);
  });

  it("expires after 30 days and slides while in use", async () => {
    const [{ id }] = await t.db.select({ id: users.id }).from(users);
    const start = new Date("2026-01-01T00:00:00Z");
    const { token } = await createSession(t.db, id, "", start);
    expect((await readSession(t.db, token, new Date("2026-01-01T00:30:00Z")))?.refreshed).toBe(false);
    const later = await readSession(t.db, token, new Date("2026-01-20T00:00:00Z"));
    expect(later?.refreshed).toBe(true);
    expect(later?.expiresAt.toISOString()).toBe("2026-02-19T00:00:00.000Z");
    expect(await readSession(t.db, token, new Date("2026-02-19T00:00:01Z"))).toBeNull();
    expect(await readSession(t.db, "garbage", new Date())).toBeNull();
  });

  it("ends a session 90 days after sign-in however active it is", async () => {
    const [{ id }] = await t.db.select({ id: users.id }).from(users);
    const day = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 86_400_000);
    const { token } = await createSession(t.db, id, "", day(0));
    for (const n of [20, 45, 70, 89]) expect(await readSession(t.db, token, day(n))).not.toBeNull();
    expect(await readSession(t.db, token, new Date(day(90).getTime() + 1000))).toBeNull();
  });
});

describe("password change", () => {
  const change = (cookie: string | undefined, body: unknown, origin: string | null = ORIGIN) => changePassword(request("POST", "/api/auth/password", { cookie, body, origin }), t.db);

  it("needs a session, the right origin and the current password", async () => {
    expect((await change(undefined, { currentPassword: PASSWORD, newPassword: "a brand new password" })).status).toBe(401);
    const cookie = cookieFrom(await signIn());
    expect((await change(cookie, { currentPassword: PASSWORD, newPassword: "a brand new password" }, "https://evil.example")).status).toBe(403);
    expect((await change(cookie, { currentPassword: "not the password", newPassword: "a brand new password" })).status).toBe(401);
    expect((await change(cookie, { currentPassword: PASSWORD, newPassword: "short" })).status).toBe(400);
  });

  it("changes the password and signs out other devices only", async () => {
    const here = cookieFrom(await signIn(PASSWORD, { ip: "198.51.100.1" }));
    const elsewhere = cookieFrom(await signIn(PASSWORD, { ip: "198.51.100.2" }));
    expect((await change(here, { currentPassword: PASSWORD, newPassword: "a brand new password" })).status).toBe(200);
    expect(await (await session(request("GET", "/api/auth/session", { cookie: here }), t.db)).json()).toMatchObject({ user: { email: EMAIL } });
    expect(await (await session(request("GET", "/api/auth/session", { cookie: elsewhere }), t.db)).json()).toEqual({ user: null });
    expect((await signIn(PASSWORD)).status).toBe(401);
    expect((await signIn("a brand new password")).status).toBe(200);
  });

  it("resetting from the CLI signs the owner out everywhere", async () => {
    const cookie = cookieFrom(await signIn());
    const [{ id }] = await t.db.select({ id: users.id }).from(users).where(eq(users.email, EMAIL));
    await setPassword(t.db, id, "reset from the server");
    expect(await (await session(request("GET", "/api/auth/session", { cookie }), t.db)).json()).toEqual({ user: null });
    expect((await signIn("reset from the server")).status).toBe(200);
  });
});
