import type { FamilyTree } from "../model";
import type { OnlineTree } from "../domain/onlineTypes";
import { isServerPhotoPath } from "../domain/serialization";

/**
 * Uploaded photos never travel inside a tree save. A picked photo (a data URL) waits here until its person
 * exists on the server, then goes to PUT /api/trees/:id/people/:personId/photo; removing a photo queues a
 * DELETE. The queue lives in browser storage so it survives reloads and offline periods, and it is laid
 * over every tree the server sends back, so a waiting photo never disappears from the screen.
 *
 * Each task has an id. When the request succeeds the task is only marked `done`; it leaves the queue
 * when a tree from the server confirms it (`settle`). That way a newer task for the same person is never
 * removed by an older request finishing, and the photo never flickers to empty in between.
 */
type TaskBase = { id: string; treeId: string; personId: string; done?: boolean; /** Version the server returned for a finished upload. */ version?: string };
export type PhotoTask = (TaskBase & { action: "upload"; dataUrl: string }) | (TaskBase & { action: "delete" });
export type NewPhotoTask = { treeId: string; personId: string } & ({ action: "upload"; dataUrl: string } | { action: "delete" });

export const PHOTO_QUEUE_KEY = "heritg-photo-queue-v1";
type StorageLike = Pick<Storage, "getItem" | "setItem">;

const isDataUrl = (value: string | undefined) => typeof value === "string" && value.startsWith("data:image/");
const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export class PhotoQueue {
  constructor(private readonly storage: StorageLike) {}

  list(treeId?: string): PhotoTask[] {
    try {
      const value = JSON.parse(this.storage.getItem(PHOTO_QUEUE_KEY) ?? "[]") as PhotoTask[];
      const valid = Array.isArray(value) ? value.filter(task => task && typeof task.id === "string" && typeof task.treeId === "string" && typeof task.personId === "string" && (task.action === "delete" || (task.action === "upload" && isDataUrl(task.dataUrl)))) : [];
      return treeId ? valid.filter(task => task.treeId === treeId) : valid;
    } catch {
      return [];
    }
  }

  /** False when browser storage is full or unavailable; callers must tell the user. */
  private write(tasks: PhotoTask[]): boolean {
    try { this.storage.setItem(PHOTO_QUEUE_KEY, JSON.stringify(tasks)); return true; } catch { return false; }
  }

  /** One task per person: the latest change wins. */
  set(task: NewPhotoTask): boolean {
    return this.write([...this.list().filter(item => !(item.treeId === task.treeId && item.personId === task.personId)), { ...task, id: newId() } as PhotoTask]);
  }

  /** The request for `task` succeeded; keep it (as done) until a server tree confirms it. No-op if replaced meanwhile. */
  markDone(task: PhotoTask, version?: string): void {
    this.write(this.list().map(item => item.id === task.id ? { ...item, done: true, ...(version ? { version } : {}) } : item));
  }

  /** Drop `task` (e.g. rejected by the server) unless a newer task for the person replaced it. */
  discard(task: PhotoTask): void {
    this.write(this.list().filter(item => item.id !== task.id));
  }

  /** Forget tasks of people this device just deleted (never prune by "not in my tree": other tabs may be ahead). */
  forgetPeople(treeId: string, personIds: Iterable<string>): void {
    const gone = new Set(personIds);
    if (gone.size) this.write(this.list().filter(item => item.treeId !== treeId || !gone.has(item.personId)));
  }

  /** The tree was deleted on the server: its waiting photo tasks have nowhere to go. */
  forgetTree(treeId: string): void {
    const tasks = this.list();
    const remaining = tasks.filter(task => task.treeId !== treeId);
    if (remaining.length !== tasks.length) this.write(remaining);
  }

  /** Remove finished tasks that this server tree already reflects. */
  settle(tree: OnlineTree): void {
    const versions = new Map(tree.people.map(person => [person.id, person.photoVersion ?? null]));
    const tasks = this.list();
    const remaining = tasks.filter(task => {
      if (task.treeId !== tree.id || !task.done) return true;
      if (!versions.has(task.personId)) return false;
      const version = versions.get(task.personId);
      // An upload is confirmed by exactly its own version (an older photo of the person does not count).
      return task.action === "upload" ? (task.version ? version !== task.version : !version) : Boolean(version);
    });
    if (remaining.length !== tasks.length) this.write(remaining);
  }
}

/** Photo changes between two versions of a local tree, for the online tree `treeId`. A link always wins. */
export function photoTasks(before: FamilyTree | undefined, after: FamilyTree, treeId: string): NewPhotoTask[] {
  const previous = new Map(before?.people.map(person => [person.id, person]));
  const tasks: NewPhotoTask[] = [];
  for (const person of after.people) {
    const old = previous.get(person.id);
    const photo = person.photo ?? "", oldPhoto = old?.photo ?? "";
    if (photo === oldPhoto) continue;
    if (isDataUrl(photo) && !person.photoUrl) tasks.push({ treeId, personId: person.id, action: "upload", dataUrl: photo });
    // Removing a stored photo, or one still waiting to upload: the delete replaces any pending upload
    // (and is a harmless no-op on the server when nothing was stored yet).
    else if (!photo && (isServerPhotoPath(oldPhoto) || isDataUrl(oldPhoto))) tasks.push({ treeId, personId: person.id, action: "delete" });
  }
  return tasks;
}

/** People present before and missing after: this device deleted them. */
export function removedPeople(before: FamilyTree | undefined, after: FamilyTree): string[] {
  const now = new Set(after.people.map(person => person.id));
  return (before?.people ?? []).map(person => person.id).filter(id => !now.has(id));
}

/** Show waiting (and just-finished) uploads and removals on a tree that came from the server. */
export function withPendingPhotos(tree: FamilyTree, tasks: PhotoTask[]): FamilyTree {
  if (!tasks.length) return tree;
  const byPerson = new Map(tasks.map(task => [task.personId, task]));
  return { ...tree, people: tree.people.map(person => {
    const task = byPerson.get(person.id);
    if (!task) return person;
    return task.action === "upload" ? { ...person, photo: task.dataUrl } : { ...person, photo: "" };
  }) };
}
