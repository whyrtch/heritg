import { getDb } from "@/server/db/client";
import { deletePublication, putPublication } from "@/server/publications/handlers";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  return putPublication(request, getDb(), (await params).id);
}

export async function DELETE(request: Request, { params }: Context) {
  return deletePublication(request, getDb(), (await params).id);
}
