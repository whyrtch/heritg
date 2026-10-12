import { describe, expect, it, vi } from "vitest";
import { dataUrlToBytes } from "../domain/photoData";
import { HttpPhotoClient } from "./HttpPhotoClient";

const reply = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

describe("HttpPhotoClient", () => {
  it("uploads raw bytes with the image type and returns the version", async () => {
    const fetch = vi.fn((...args: [string, RequestInit?]) => { void args; return reply(200, { photoVersion: "0123456789abcdef" }); });
    const photo = dataUrlToBytes("data:image/jpeg;base64,/9j/4AAQ");
    expect(photo.mime).toBe("image/jpeg");
    expect(Array.from(photo.bytes.slice(0, 3))).toEqual([0xff, 0xd8, 0xff]);
    const version = await new HttpPhotoClient(fetch as typeof globalThis.fetch).upload("tree 1", "budi", photo);
    expect(version).toBe("0123456789abcdef");
    expect(fetch.mock.calls[0][0]).toBe("/api/trees/tree%201/people/budi/photo");
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: "PUT", credentials: "same-origin", headers: { "Content-Type": "image/jpeg" } });
  });

  it.each([[404, "not-found"], [400, "rejected"], [413, "rejected"], [415, "rejected"], [401, "offline"], [429, "offline"], [500, "offline"]])("maps HTTP %i to %s", async (status, code) => {
    const client = new HttpPhotoClient((() => reply(status, { error: { message: "no" } })) as typeof globalThis.fetch);
    await expect(client.remove("t", "p")).rejects.toMatchObject({ code });
  });

  it("treats an unreachable server as offline", async () => {
    const client = new HttpPhotoClient((() => Promise.reject(new TypeError("Failed to fetch"))) as typeof globalThis.fetch);
    await expect(client.upload("t", "p", { mime: "image/webp", bytes: new Uint8Array(4) })).rejects.toMatchObject({ code: "offline" });
  });

  it("refuses data URLs that are not JPEG or WebP thumbnails", () => {
    expect(() => dataUrlToBytes("data:image/png;base64,AAAA")).toThrow();
    expect(() => dataUrlToBytes("data:image/svg+xml;base64,AAAA")).toThrow();
  });
});
