import type { OnlineTree } from "../domain/onlineTypes";
import { TreeRepositoryError, type TreeRepository, type TreeRepositoryErrorCode } from "./TreeRepository";

type Fetch = typeof fetch;

/** A request that hangs this long is treated as offline, so the save queue behind it can move on. */
export const REQUEST_TIMEOUT_MS = 30_000;

/**
 * TreeRepository backed by our own API (/api/trees). The session cookie authenticates every call.
 * HTTP failures become the TreeRepositoryError codes useTreeSync and the migration already handle:
 * unreachable server or 5xx → "offline" (the edit stays queued), 409 → "conflict", 404 → "not-found",
 * 401/403 → "permission-denied", 4xx validation → "invalid-data".
 */
export class HttpTreeRepository implements TreeRepository {
  constructor(private readonly fetchImpl: Fetch = (...args) => fetch(...args), private readonly base = "/api/trees") {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.base}${path}`, { ...init, signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS), credentials: "same-origin", headers: { Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers } });
    } catch (error) {
      throw new TreeRepositoryError("offline", "The family tree service is unavailable.", { cause: error });
    }
    const body = await response.json().catch(() => null) as ({ error?: { code?: string; message?: string } } & T) | null;
    if (response.ok && body) return body;
    throw new TreeRepositoryError(errorCode(response.status), body?.error?.message ?? "The family tree operation could not be completed.");
  }

  async listOwned(): Promise<OnlineTree[]> {
    return (await this.request<{ trees: OnlineTree[] }>("")).trees;
  }

  async load(treeId: string): Promise<OnlineTree> {
    return (await this.request<{ tree: OnlineTree }>(`/${encodeURIComponent(treeId)}`)).tree;
  }

  async create(tree: OnlineTree): Promise<OnlineTree> {
    return (await this.request<{ tree: OnlineTree }>("", { method: "POST", body: JSON.stringify({ tree }) })).tree;
  }

  async save(tree: OnlineTree, expectedRevision: number): Promise<OnlineTree> {
    return (await this.request<{ tree: OnlineTree }>(`/${encodeURIComponent(tree.id)}`, { method: "PUT", body: JSON.stringify({ tree, expectedRevision }) })).tree;
  }

  async delete(treeId: string): Promise<void> {
    await this.request(`/${encodeURIComponent(treeId)}`, { method: "DELETE" });
  }
}

function errorCode(status: number): TreeRepositoryErrorCode {
  if (status === 409) return "conflict";
  if (status === 404) return "not-found";
  if (status === 401 || status === 403) return "permission-denied";
  if (status === 429 || status >= 500) return "offline";
  return "invalid-data";
}
