import { getDb } from "@/server/db/client";
import { getPublicPersonPhoto } from "@/server/photos/handlers";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ publicId: string; personId: string }> };

export async function GET(request: Request, { params }: Context) {
  const { publicId, personId } = await params;
  return getPublicPersonPhoto(request, getDb(), publicId, personId);
}
