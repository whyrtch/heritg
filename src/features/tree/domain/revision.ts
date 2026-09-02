export type Revisioned = { revision: number };

export function nextRevision(current: number): number {
  if (!Number.isSafeInteger(current) || current < 0) throw new Error("Revision must be a non-negative safe integer.");
  return current + 1;
}

export function detectRevisionConflict(expectedRevision: number, remote: number | Revisioned): boolean {
  const remoteRevision = typeof remote === "number" ? remote : remote.revision;
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || !Number.isSafeInteger(remoteRevision) || remoteRevision < 0) {
    throw new Error("Revisions must be non-negative safe integers.");
  }
  return expectedRevision !== remoteRevision;
}
