import { logout } from "@/server/auth/handlers";
import { getDb } from "@/server/db/client";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return logout(request, getDb());
}
