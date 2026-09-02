"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FamilyTree, initialData, WorkspaceData } from "./model";
import { createJokowiDemoTree, JOKOWI_DEMO_TREE_ID } from "./demoData";
import { LocalTreeCache } from "./repository/LocalTreeCache";

export function useWorkspaceData() {
  const [data, setData] = useState<WorkspaceData | null>(null);
  useEffect(() => {
    try {
      const current = new LocalTreeCache(window.localStorage).loadWorkspace() ?? initialData();
      if (current.trees.some(tree => tree.id === JOKOWI_DEMO_TREE_ID)) { setData(current); return; }
      const active = current.trees.find(tree => tree.id === current.activeTreeId);
      const demo = createJokowiDemoTree();
      setData({ ...current, trees: [demo, ...current.trees], activeTreeId: !active || active.people.length === 0 ? demo.id : current.activeTreeId });
    }
    catch { const demo = createJokowiDemoTree(); setData({ version: 1, activeTreeId: demo.id, trees: [demo] }); }
  }, []);
  useEffect(() => { if (data) new LocalTreeCache(window.localStorage).saveWorkspace(data); }, [data]);
  const active = useMemo(() => data?.trees.find(t => t.id === data.activeTreeId) ?? null, [data]);
  const updateActive = useCallback((updater: (tree: FamilyTree) => FamilyTree) => setData(current => current ? ({ ...current, trees: current.trees.map(t => t.id === current.activeTreeId ? updater(t) : t) }) : current), []);
  return { data, setData, active, updateActive };
}
