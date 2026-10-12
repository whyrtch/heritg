import "server-only";
export type ApiErrorCode = "unauthenticated" | "forbidden" | "not-found" | "conflict" | "invalid" | "invalid-credentials" | "rate-limited" | "too-large" | "server-error";

/** An expected failure that maps to an HTTP response with `{ error: { code, message } }`. */
export class ApiProblem extends Error {
  constructor(public readonly status: number, public readonly code: ApiErrorCode, message: string, public readonly details?: unknown) {
    super(message);
    this.name = "ApiProblem";
  }
}

const NO_STORE = { "Cache-Control": "no-store" };

export function json(body: unknown, init: { status?: number; headers?: HeadersInit } = {}): Response {
  const headers = new Headers(init.headers);
  for (const [key, value] of Object.entries(NO_STORE)) if (!headers.has(key)) headers.set(key, value);
  return Response.json(body, { status: init.status ?? 200, headers });
}

export function problemResponse(problem: ApiProblem, headers?: HeadersInit): Response {
  return json({ error: { code: problem.code, message: problem.message, ...(problem.details === undefined ? {} : { details: problem.details }) } }, { status: problem.status, headers });
}

/** Run a handler, turning ApiProblems into JSON errors and anything else into a neutral 500. */
export async function handle(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ApiProblem) return problemResponse(error);
    console.error("[api] unexpected error", error);
    return problemResponse(new ApiProblem(500, "server-error", "Something went wrong. Please try again."));
  }
}

/** Read a JSON body of at most `maxBytes`, streaming so an oversized or chunked body is never fully buffered. */
export async function readJson(request: Request, maxBytes: number): Promise<unknown> {
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) throw new ApiProblem(415, "invalid", "Send JSON.");
  const declared = request.headers.get("content-length");
  if (declared !== null && !/^\d+$/.test(declared)) throw new ApiProblem(400, "invalid", "Invalid Content-Length.");
  if (declared !== null && Number(declared) > maxBytes) throw new ApiProblem(413, "too-large", "This request is too large.");
  const bytes = await readLimited(request, maxBytes);
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ApiProblem(400, "invalid", "The request body is not valid JSON.");
  }
}

/** Read at most `maxBytes` of the body; stop and cancel the stream as soon as it is exceeded. */
export async function readLimited(request: Request, maxBytes: number): Promise<Uint8Array> {
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new ApiProblem(413, "too-large", "This request is too large.");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.byteLength; }
  return out;
}
