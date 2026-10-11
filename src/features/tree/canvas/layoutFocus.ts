import type { FamilyTree } from "../model";
import { layoutFull, type CanvasLayout } from "./layoutFull";

export type FocusOptions = {
  /** Also show brothers and sisters (children of the focus person's parents). */
  siblings: boolean;
  /** Generations shown above the focus person; 1 = parents. "Leluhur lainnya" adds one. */
  ancestorDepth: number;
  /** Generations shown below the focus person; 1 = children. "Keturunan lainnya" adds one. */
  descendantDepth: number;
};
export const DEFAULT_FOCUS: FocusOptions = { siblings: false, ancestorDepth: 1, descendantDepth: 1 };

export type FocusSelection = { ids: Set<string>; moreAncestors: boolean; moreDescendants: boolean };

type TreeGraph = Pick<FamilyTree, "people" | "relationships">;

/**
 * People in the Fokus view: the focus person and their partners, ancestors up to `ancestorDepth`
 * generations (with each ancestor's partners, so a parent couple stays together), descendants down to
 * `descendantDepth`, and optionally siblings.
 */
export function focusSelection(tree: TreeGraph, focusId: string, options: FocusOptions = DEFAULT_FOCUS): FocusSelection {
  const known = new Set(tree.people.map(person => person.id));
  if (!known.has(focusId)) return { ids: new Set(), moreAncestors: false, moreDescendants: false };
  const parents = new Map<string, string[]>(), children = new Map<string, string[]>(), partners = new Map<string, string[]>();
  const push = (map: Map<string, string[]>, key: string, value: string) => map.set(key, [...(map.get(key) ?? []), value]);
  for (const r of tree.relationships) {
    if (!known.has(r.from) || !known.has(r.to)) continue;
    if (r.type === "parent-child") { push(parents, r.to, r.from); push(children, r.from, r.to); }
    else { push(partners, r.from, r.to); push(partners, r.to, r.from); }
  }
  const ids = new Set([focusId, ...(partners.get(focusId) ?? [])]);

  let frontier = [focusId];
  for (let depth = 0; depth < options.ancestorDepth; depth += 1) {
    const next = frontier.flatMap(id => parents.get(id) ?? []).filter(id => !ids.has(id));
    next.forEach(id => { ids.add(id); (partners.get(id) ?? []).forEach(partner => ids.add(partner)); });
    frontier = [...new Set(next)];
  }
  const moreAncestors = frontier.some(id => (parents.get(id) ?? []).some(parent => !ids.has(parent)));

  if (options.siblings) (parents.get(focusId) ?? []).forEach(parent => (children.get(parent) ?? []).forEach(sibling => ids.add(sibling)));

  frontier = [focusId];
  for (let depth = 0; depth < options.descendantDepth; depth += 1) {
    frontier = [...new Set(frontier.flatMap(id => children.get(id) ?? []))];
    frontier.forEach(id => ids.add(id));
  }
  const moreDescendants = frontier.some(id => (children.get(id) ?? []).some(child => !ids.has(child)));
  return { ids, moreAncestors, moreDescendants };
}

/** Lay out only the Fokus selection, with the same grid and connectors as the Lengkap view. */
export function layoutFocus(tree: TreeGraph, focusId: string, options: FocusOptions = DEFAULT_FOCUS): CanvasLayout & FocusSelection {
  const selection = focusSelection(tree, focusId, options);
  const subtree = {
    people: tree.people.filter(person => selection.ids.has(person.id)),
    relationships: tree.relationships.filter(r => selection.ids.has(r.from) && selection.ids.has(r.to)),
  };
  return { ...layoutFull(subtree), ...selection };
}
