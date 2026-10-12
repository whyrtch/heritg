import { getDb } from "@/server/db/client";
import { listTrees, postTree } from "@/server/trees/handlers";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return listTrees(request, getDb());
}

export function POST(request: Request) {
  return postTree(request, getDb());
}
