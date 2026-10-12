import { describe, expect, it } from "vitest";
import type { OnlineTree } from "../domain/onlineTypes";
import { emptyPerson, newTree, type FamilyTree } from "../model";
import { PHOTO_QUEUE_KEY, PhotoQueue, photoTasks, removedPeople, withPendingPhotos } from "./photoQueue";

const SERVER = "/api/trees/remote/people/budi/photo?v=0123456789abcdef";
const DATA = "data:image/webp;base64,AAAA", DATA2 = "data:image/webp;base64,BBBB";
const tree = (photos: Record<string, string>, links: Record<string, string> = {}): FamilyTree => ({ ...newTree(), people: Object.entries(photos).map(([id, photo]) => ({ ...emptyPerson(), id, name: id, photo, photoUrl: links[id] ?? "" })) });
const serverTree = (versions: Record<string, string | null>) => ({ id: "t", people: Object.entries(versions).map(([id, photoVersion]) => ({ id, photoVersion })) }) as unknown as OnlineTree;
class MemoryStorage { values = new Map<string, string>(); getItem(key: string) { return this.values.get(key) ?? null; } setItem(key: string, value: string) { this.values.set(key, value); } }
class FullStorage extends MemoryStorage { setItem() { throw new DOMException("full", "QuotaExceededError"); } }

describe("photo tasks from edits", () => {
  it("queues new uploads and deliberate removals of stored photos only", () => {
    const before = tree({ budi: SERVER, sari: "", ani: DATA, link: SERVER });
    const after = tree({ budi: "", sari: DATA, ani: DATA, link: "" }, { link: "https://example.com/a.jpg" });
    expect(photoTasks(before, after, "remote")).toEqual([
      { treeId: "remote", personId: "budi", action: "delete" },
      { treeId: "remote", personId: "sari", action: "upload", dataUrl: DATA },
      { treeId: "remote", personId: "link", action: "delete" },
    ]);
    expect(photoTasks(tree({ budi: SERVER }), tree({ budi: SERVER }), "remote")).toEqual([]);
  });

  it("cancels a photo that has not finished uploading when it is removed", () => {
    const queue = new PhotoQueue(new MemoryStorage());
    queue.set({ treeId: "remote", personId: "budi", action: "upload", dataUrl: DATA });
    photoTasks(tree({ budi: DATA }), tree({ budi: "" }), "remote").forEach(task => queue.set(task));
    expect(queue.list("remote")).toMatchObject([{ personId: "budi", action: "delete" }]);
    expect(withPendingPhotos(tree({ budi: "" }), queue.list("remote")).people[0].photo).toBe("");
  });

  it("lets a photo link win over an embedded image", () => {
    expect(photoTasks(undefined, tree({ x: DATA }, { x: "https://example.com/x.jpg" }), "remote")).toEqual([]);
  });

  it("knows which people this device deleted", () => {
    expect(removedPeople(tree({ a: "", b: "", c: "" }), tree({ a: "" }))).toEqual(["b", "c"]);
    expect(removedPeople(undefined, tree({ a: "" }))).toEqual([]);
  });
});

describe("photo queue", () => {
  it("keeps one task per person and survives reloads", () => {
    const storage = new MemoryStorage();
    const queue = new PhotoQueue(storage);
    queue.set({ treeId: "t", personId: "a", action: "upload", dataUrl: DATA });
    queue.set({ treeId: "t", personId: "a", action: "delete" });
    queue.set({ treeId: "t", personId: "b", action: "upload", dataUrl: DATA });
    expect(new PhotoQueue(storage).list("t").map(task => [task.personId, task.action])).toEqual([["a", "delete"], ["b", "upload"]]);
  });

  it("never lets an older request finishing remove a newer task", () => {
    const queue = new PhotoQueue(new MemoryStorage());
    queue.set({ treeId: "t", personId: "a", action: "upload", dataUrl: DATA });
    const inFlight = queue.list("t")[0];
    queue.set({ treeId: "t", personId: "a", action: "delete" });
    queue.markDone(inFlight);
    queue.discard(inFlight);
    expect(queue.list("t")).toMatchObject([{ personId: "a", action: "delete" }]);
    expect(queue.list("t")[0].done).toBeUndefined();
  });

  it("keeps finished tasks until the server confirms them", () => {
    const queue = new PhotoQueue(new MemoryStorage());
    queue.set({ treeId: "t", personId: "a", action: "upload", dataUrl: DATA });
    queue.set({ treeId: "t", personId: "b", action: "delete" });
    const [upload, removal] = queue.list("t");
    queue.markDone(upload, "aaaaaaaaaaaaaaaa");
    queue.markDone(removal);
    queue.settle(serverTree({ a: null, b: "0123456789abcdef" }));
    expect(queue.list("t")).toHaveLength(2);
    // An older photo of the person is not confirmation of this upload.
    queue.settle(serverTree({ a: "0123456789abcdef", b: null }));
    expect(queue.list("t").map(task => task.personId)).toEqual(["a"]);
    queue.settle(serverTree({ a: "aaaaaaaaaaaaaaaa", b: null }));
    expect(queue.list("t")).toEqual([]);
  });

  it("forgets only the people this device deleted", () => {
    const queue = new PhotoQueue(new MemoryStorage());
    queue.set({ treeId: "t", personId: "a", action: "upload", dataUrl: DATA });
    queue.set({ treeId: "t", personId: "from-other-tab", action: "upload", dataUrl: DATA2 });
    queue.forgetPeople("t", ["a"]);
    expect(queue.list("t").map(task => task.personId)).toEqual(["from-other-tab"]);
  });

  it("reports a full browser storage instead of silently dropping the photo", () => {
    expect(new PhotoQueue(new FullStorage()).set({ treeId: "t", personId: "a", action: "upload", dataUrl: DATA })).toBe(false);
  });

  it("ignores corrupt or unsafe stored entries", () => {
    const storage = new MemoryStorage();
    storage.setItem(PHOTO_QUEUE_KEY, JSON.stringify([{ id: "1", treeId: "t", personId: "a", action: "upload", dataUrl: "javascript:alert(1)" }, null, { id: "2", treeId: "t", personId: "b", action: "delete" }, { treeId: "t", personId: "c", action: "delete" }]));
    expect(new PhotoQueue(storage).list().map(task => task.personId)).toEqual(["b"]);
    storage.setItem(PHOTO_QUEUE_KEY, "not json");
    expect(new PhotoQueue(storage).list()).toEqual([]);
  });

  it("shows waiting uploads and removals on a server tree, keeping photo links", () => {
    const fromServer = tree({ budi: SERVER, sari: "" }, { sari: "https://example.com/s.jpg" });
    const shown = withPendingPhotos(fromServer, [{ id: "1", treeId: "t", personId: "budi", action: "delete" }, { id: "2", treeId: "t", personId: "sari", action: "upload", dataUrl: DATA }]);
    expect(shown.people.map(person => [person.photo, person.photoUrl])).toEqual([["", ""], [DATA, "https://example.com/s.jpg"]]);
    expect(withPendingPhotos(fromServer, [])).toBe(fromServer);
  });
});

describe("forgetTree", () => {
  it("drops every task of one tree and keeps the others", () => {
    const queue = new PhotoQueue(new MemoryStorage());
    queue.set({ treeId: "gone", personId: "a", action: "upload", dataUrl: DATA });
    queue.set({ treeId: "gone", personId: "b", action: "delete" });
    queue.set({ treeId: "kept", personId: "a", action: "upload", dataUrl: DATA2 });
    queue.forgetTree("gone");
    expect(queue.list("gone")).toEqual([]);
    expect(queue.list("kept")).toHaveLength(1);
  });

  it("does not write when the tree has no tasks", () => {
    const storage = new MemoryStorage();
    new PhotoQueue(storage).forgetTree("nothing");
    expect(storage.values.size).toBe(0);
  });
});
