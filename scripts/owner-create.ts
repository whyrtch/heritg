// Create the archive owner account (there is no public registration).
// Usage: npm run owner:create -- owner@example.com "Display name"
import { ask, askNewPassword, loadEnv } from "./owner-cli";

async function main() {
  loadEnv();
  const { getDb } = await import("@/server/db/client");
  const { AccountError, createOwner } = await import("@/server/auth/users");

  const email = process.argv[2] ?? await ask("Owner email: ");
  const displayName = process.argv[3] ?? "";
  const password = await askNewPassword();
  try {
    const owner = await createOwner(getDb(), email, password, displayName);
    console.log(`Owner account created for ${owner.email}.`);
    process.exit(0);
  } catch (error) {
    console.error(error instanceof AccountError ? error.message : error);
    process.exit(1);
  }
}

void main();
