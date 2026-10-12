import { getDb } from "@/server/db/client";
import { getPublicSnapshot } from "@/server/publications/handlers";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ publicId: string }> };

export async function GET(request: Request, { params }: Context) {
  return getPublicSnapshot(request, getDb(), (await params).publicId);
}
