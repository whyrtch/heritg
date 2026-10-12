import { getDb } from "@/server/db/client";
import { deletePersonPhoto, getPersonPhoto, putPersonPhoto } from "@/server/photos/handlers";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; personId: string }> };

export async function GET(request: Request, { params }: Context) {
  const { id, personId } = await params;
  return getPersonPhoto(request, getDb(), id, personId);
}

export async function PUT(request: Request, { params }: Context) {
  const { id, personId } = await params;
  return putPersonPhoto(request, getDb(), id, personId);
}

export async function DELETE(request: Request, { params }: Context) {
  const { id, personId } = await params;
  return deletePersonPhoto(request, getDb(), id, personId);
}
