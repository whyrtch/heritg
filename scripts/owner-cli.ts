import { existsSync } from "node:fs";
import { createInterface } from "node:readline";

/** Load DATABASE_URL and friends the same way Next.js does for local development. */
export function loadEnv(): void {
  for (const file of [".env.local", ".env"]) if (existsSync(file)) process.loadEnvFile(file);
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Put it in .env.local (see docker-compose.yml for a local database).");
    process.exit(1);
  }
}

export function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer.trim()); }));
}

/** Read a password without echoing it. HERITG_OWNER_PASSWORD can supply it for non-interactive use. */
export function askHidden(question: string): Promise<string> {
  if (process.env.HERITG_OWNER_PASSWORD) return Promise.resolve(process.env.HERITG_OWNER_PASSWORD);
  if (!process.stdin.isTTY) return ask(question);
  return new Promise(resolve => {
    process.stdout.write(question);
    let value = "";
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n" || char === "\u0004") {
          stdin.setRawMode(false); stdin.pause(); stdin.off("data", onData); process.stdout.write("\n"); resolve(value); return;
        }
        if (char === "\u0003") { process.stdout.write("\n"); process.exit(130); }
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else value += char;
      }
    };
    stdin.on("data", onData);
  });
}

export async function askNewPassword(): Promise<string> {
  const password = await askHidden("New password (min. 12 characters): ");
  if (!process.env.HERITG_OWNER_PASSWORD && password !== await askHidden("Repeat the password: ")) {
    console.error("The passwords do not match.");
    process.exit(1);
  }
  return password;
}
