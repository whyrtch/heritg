import { session } from "@/server/auth/handlers";
import { getDb } from "@/server/db/client";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return session(request, getDb());
}
