"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FamilyTree, initialData, WorkspaceData } from "./model";

const KEY = "heritg-workspace-v1";
export function useWorkspaceData() {
  const [data, setData] = useState<WorkspaceData | null>(null);
  useEffect(() => {
    try { const stored = localStorage.getItem(KEY); setData(stored ? JSON.parse(stored) as WorkspaceData : initialData()); }
    catch { setData(initialData()); }
  }, []);
  useEffect(() => { if (data) localStorage.setItem(KEY, JSON.stringify(data)); }, [data]);
  const active = useMemo(() => data?.trees.find(t => t.id === data.activeTreeId) ?? null, [data]);
  const updateActive = useCallback((updater: (tree: FamilyTree) => FamilyTree) => setData(current => current ? ({ ...current, trees: current.trees.map(t => t.id === current.activeTreeId ? updater(t) : t) }) : current), []);
  return { data, setData, active, updateActive };
}
