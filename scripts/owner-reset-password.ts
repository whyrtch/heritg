// Reset the owner's password from the server and sign the account out on every device.
// Usage: npm run owner:reset-password -- owner@example.com
import { ask, askNewPassword, loadEnv } from "./owner-cli";

async function main() {
  loadEnv();
  const { getDb } = await import("@/server/db/client");
  const { AccountError, findUserByEmail, setPassword } = await import("@/server/auth/users");

  const email = process.argv[2] ?? await ask("Owner email: ");
  const db = getDb();
  const user = await findUserByEmail(db, email);
  if (!user) {
    console.error("No account with that email.");
    process.exit(1);
  }
  try {
    await setPassword(db, user.id, await askNewPassword());
    console.log(`Password reset for ${user.email}. Every device has been signed out.`);
    process.exit(0);
  } catch (error) {
    console.error(error instanceof AccountError ? error.message : error);
    process.exit(1);
  }
}

void main();
