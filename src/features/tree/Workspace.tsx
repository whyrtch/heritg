"use client";

import { ChangeEvent, FormEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { Menu, Share2, SlidersHorizontal, Sparkles } from "lucide-react";
import { addRelationship, displayName, emptyPerson, exportTree, FamilyTree, importTree, layoutTree, newTree, Person, removePerson } from "./model";
import { fromOnlineTree, toOnlineTree } from "./domain/serialization";
import type { OnlineTree } from "./domain/onlineTypes";
import { useAuth } from "@/features/auth/useAuth";
import { BackendTreeRepository } from "./repository/BackendTreeRepository";
import { BackendPublicationRepository } from "./publishing/BackendPublicationRepository";
import { LocalTreeCache } from "./repository/LocalTreeCache";
import { AuthLoginForm } from "@/features/auth/AuthLoginForm";
import { SyncStatus } from "./components/SyncStatus";
import { ConflictDialog } from "./components/ConflictDialog";
import { MigrationDialog } from "./components/MigrationDialog";
import { PublishDialog } from "./components/PublishDialog";
import { planMigration } from "./migration/planMigration";
import { LocalCacheMigrationStateStore, runMigration } from "./migration/runMigration";
import type { MigrationProgress, MigrationRunResult } from "./migration/types";
import { useTreeSync } from "./sync/useTreeSync";
import { useWorkspaceData } from "./useWorkspace";
import styles from "./workspace.module.css";

type EditorIntent = { mode: "create" | "edit"; person?: Person; relation?: "parent-child" | "partner"; anchorId?: string; reverse?: boolean };

const IconButton = ({ label, children, onClick, disabled, className = "" }: { label: string; children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) => (
  <button className={`${styles.iconButton} ${className}`} aria-label={label} title={label} onClick={onClick} disabled={disabled}>
    {children}
  </button>
);

function Brand() {
  return <div className={styles.brand}><span className={styles.brandMark}>❈</span><span>Heritg</span></div>;
}

export function Workspace() {
  const { data, setData, active, updateActive } = useWorkspaceData();
  const { user, status } = useAuth();
  const online = status === "authenticated" && Boolean(user);
  const cache = useMemo(() => typeof window !== "undefined" ? new LocalTreeCache(window.localStorage) : null, []);
  const treeRepository = useMemo(() => online ? new BackendTreeRepository() : null, [online]);
  const publicationRepository = useMemo(() => online ? new BackendPublicationRepository() : null, [online]);
  const syncApi = useRef<{ mutate: (tree: FamilyTree) => void } | null>(null);
  const [onlineTree, setOnlineTree] = useState<OnlineTree | null>(null);
  const [onlineEpoch, setOnlineEpoch] = useState(0);
  const [publishOpen, setPublishOpen] = useState(false);
  const [migrationVisible, setMigrationVisible] = useState(true);
  const [migrationBusy, setMigrationBusy] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null);
  const [migrationResult, setMigrationResult] = useState<MigrationRunResult | null>(null);
  const [migrationVersion, setMigrationVersion] = useState(0);
  const [sidebar, setSidebar] = useState(false);
  const [settings, setSettings] = useState(false);
  const [editor, setEditor] = useState<EditorIntent | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [directory, setDirectory] = useState(false);
  const [deferred, setDeferred] = useState<"Family+" | null>(null);
  const [privacy, setPrivacy] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const nodes = useMemo(() => active ? layoutTree(active) : [], [active]);
  const selectedPerson = active?.people.find(p => p.id === selected) ?? null;
  const activeTreeId = active?.id;
  const activePeopleCount = active?.people.length ?? 0;
  const mappings = cache?.load().migration;
  const remoteTreeId = active && mappings?.completedTreeIds.includes(active.id) ? mappings.remoteIdsByLocalId[active.id] : null;
  const activeOnlineTree = onlineTree?.id === remoteTreeId ? onlineTree : null;
  const migrationPlan = useMemo(() => {
    void migrationVersion;
    return data && user && cache ? planMigration(data, cache.load().migration, { ownerId: user.id }) : null;
  }, [cache, data, migrationVersion, user]);
  const hasPendingMigration = Boolean(migrationPlan?.items.some(item => !item.alreadyCompleted));

  useEffect(() => {
    if (!activeTreeId) return;
    setZoom(activePeopleCount > 12 ? .62 : 1);
    setPan(activePeopleCount > 12 ? { x: 0, y: -300 } : { x: 0, y: 0 });
  }, [activePeopleCount, activeTreeId]);

  if (!data || !active) return <div className={styles.loading}><Brand /><span>Opening your archive…</span></div>;

  const setTree = (tree: FamilyTree) => { updateActive(() => tree); syncApi.current?.mutate(tree); };
  const createTree = () => {
    const tree = newTree(`Family Tree ${data.trees.length + 1}`);
    setData({ ...data, trees: [...data.trees, tree], activeTreeId: tree.id });
    setMigrationVisible(true);
    setSelected(null);
    setSidebar(false);
  };
  const loadFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const tree = importTree(await file.text());
      setData({ ...data, trees: [...data.trees, tree], activeTreeId: tree.id });
      setMigrationVisible(true);
      setSidebar(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to import this file.");
    }
    event.target.value = "";
  };
  const startDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const moveDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current) setPan({ x: drag.current.px + e.clientX - drag.current.x, y: drag.current.py + e.clientY - drag.current.y });
  };
  const fit = () => {
    setPan({ x: 0, y: active.people.length > 4 ? -40 : 0 });
    setZoom(active.people.length > 8 ? .72 : active.people.length > 4 ? .86 : 1);
  };
  const focusPerson = (id: string) => {
    const node = nodes.find(n => n.id === id);
    if (node) { setPan({ x: -node.x * zoom, y: -node.y * zoom }); setSelected(id); setDirectory(false); }
  };
  const download = () => {
    const blob = new Blob([exportTree(active)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${active.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.heritg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.workspace}>
      <header className={styles.topbar}>
        <div className={styles.topLeft}>
          <IconButton label="Show family trees" onClick={() => setSidebar(true)}><Menu size={21} /></IconButton>
          <button className={styles.treeTitle} onClick={() => {
            const name = prompt("Rename family tree", active.name);
            if (name?.trim()) setTree({ ...active, name: name.trim() });
          }}>
            <strong>{active.name}</strong>
            <span>{active.people.length} {active.people.length === 1 ? "person" : "people"} · {active.relationships.length} relationships</span>
          </button>
        </div>
        <div className={styles.topActions}>
          <button className={styles.familyButton} onClick={() => setDeferred("Family+")}>
            <Sparkles size={18} /> <span>Heritg Family+</span>
          </button>
          <button className={styles.shareButton} disabled={!activeOnlineTree || !publicationRepository} onClick={() => setPublishOpen(true)}>
            <Share2 size={18} /> <span>Share</span>
          </button>
          <IconButton label="Settings" onClick={() => setSettings(true)}><SlidersHorizontal size={20} /></IconButton>
        </div>
      </header>

      {status === "unauthenticated" && (
        <div className={styles.loginBanner}>
          <AuthLoginForm />
        </div>
      )}

      <div className={styles.canvas} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={() => drag.current = null} onPointerCancel={() => drag.current = null}>
        {/* ... rest of canvas content */}
      </div>
    </div>
  );
}
