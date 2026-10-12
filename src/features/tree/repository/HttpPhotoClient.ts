export type PhotoUploadError = "offline" | "not-found" | "rejected";

export class PhotoRequestError extends Error {
  constructor(public readonly code: PhotoUploadError, message: string) {
    super(message);
    this.name = "PhotoRequestError";
  }
}

type Fetch = typeof fetch;
const path = (treeId: string, personId: string) => `/api/trees/${encodeURIComponent(treeId)}/people/${encodeURIComponent(personId)}/photo`;

/** Uploads and removes person thumbnails (owner session cookie). */
export class HttpPhotoClient {
  constructor(private readonly fetchImpl: Fetch = (...args) => fetch(...args)) {}

  private async send(url: string, init: RequestInit): Promise<Response> {
    let response: Response;
    try {
      // A hung upload counts as offline (the queue retries it later) instead of blocking the queue.
      response = await this.fetchImpl(url, { ...init, signal: init.signal ?? AbortSignal.timeout(60_000), credentials: "same-origin" });
    } catch {
      throw new PhotoRequestError("offline", "The photo service is unavailable.");
    }
    if (response.ok) return response;
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    const code: PhotoUploadError = response.status === 404 ? "not-found" : response.status === 429 || response.status >= 500 || response.status === 401 ? "offline" : "rejected";
    throw new PhotoRequestError(code, body?.error?.message ?? "The photo could not be saved.");
  }

  async upload(treeId: string, personId: string, photo: { mime: string; bytes: Uint8Array }): Promise<string> {
    const response = await this.send(path(treeId, personId), { method: "PUT", headers: { "Content-Type": photo.mime }, body: photo.bytes as unknown as BodyInit });
    return (await response.json() as { photoVersion: string }).photoVersion;
  }

  async remove(treeId: string, personId: string): Promise<void> {
    await this.send(path(treeId, personId), { method: "DELETE" });
  }
}
