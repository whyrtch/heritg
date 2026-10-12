"use client";
import React, { ChangeEvent, MutableRefObject, PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, CircleHelp, CirclePlus, Eye, EyeOff, FolderOpen, GitBranch, Hand, Maximize2, Lock, Menu, Network, Pencil, Plus, Settings2, Share2, ShieldCheck, SlidersHorizontal, Sparkles, UserPlus, Users, X, ZoomIn, ZoomOut } from "lucide-react";
import { displayName, duplicateTree, exportTree, FamilyTree, importTree, lifeDatesLong, newTree, Person, relativesOf, type Relatives, removePerson } from "./model";
import { isDemoTree } from "./demoData";
import { useT } from "@/i18n";
import { FlowerMark } from "./components/BrandMark";
import { CoachMarks } from "./components/CoachMarks";
import { fromOnlineTree, toOnlineTree } from "./domain/serialization";
import type { OnlineTree } from "./domain/onlineTypes";
import { TreeCanvas } from "./canvas/TreeCanvas";
import { PeoplePanel } from "./panels/PeoplePanel";
import { SettingsPanel, type SyncReport } from "./panels/SettingsPanel";
import { HelpPanel } from "./panels/HelpPanel";
import { PrivacyPanel } from "./panels/PrivacyPanel";
import { TreeSidebar } from "./panels/TreeSidebar";
import { RenameTreeDialog } from "./panels/RenameTreeDialog";
import { useDialect } from "./canvas/dialectSetting";
import { StartDialog } from "./dialogs/StartDialog";
import { AddRelativeWizard } from "./dialogs/AddRelativeWizard";
import { EditProfileDialog } from "./dialogs/EditProfileDialog";
import { addRelative } from "./domain/relativeActions";
import { layoutFull } from "./canvas/layoutFull";
import { DEFAULT_FOCUS, layoutFocus, type FocusOptions } from "./canvas/layoutFocus";
import { kinshipLabels } from "./canvas/kinship";
import { useAuth } from "@/features/auth/useAuth";
import { HttpTreeRepository } from "./repository/HttpTreeRepository";
import { HttpPhotoClient, PhotoRequestError } from "./repository/HttpPhotoClient";
import { PhotoQueue, photoTasks, removedPeople, withPendingPhotos } from "./sync/photoQueue";
import { prepareUpload, toThumbnailDataUrl } from "./domain/photoData";
import type { TreeRepository } from "./repository/TreeRepository";
import type { PublicationRepository } from "./publishing/PublicationRepository";
import { HttpPublicationRepository } from "./publishing/HttpPublicationRepository";
import { LocalTreeCache } from "./repository/LocalTreeCache";
import { SyncStatus } from "./components/SyncStatus";
import { ConflictDialog } from "./components/ConflictDialog";
import { MigrationDialog } from "./components/MigrationDialog";
import { PublishDialog } from "./components/PublishDialog";
import { planMigration } from "./migration/planMigration";
import { LocalCacheMigrationStateStore, runMigration, uploadNewTree } from "./migration/runMigration";
import type { MigrationProgress, MigrationRunResult } from "./migration/types";
import { useTreeSync } from "./sync/useTreeSync";
import { useWorkspaceData } from "./useWorkspace";
import styles from "./workspace.module.css";

const IconButton = ({ label, children, onClick, disabled, quiet, className = "" }: { label: string; children: React.ReactNode; onClick?: () => void; disabled?: boolean; quiet?: boolean; className?: string }) => <button className={`${styles.iconButton} ${quiet ? styles.quiet : ""} ${className}`} aria-label={label} title={label} onClick={onClick} disabled={disabled}>{children}</button>;

const MIN_ZOOM = .3, MAX_ZOOM = 1.8;
const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

function Brand() { return <div className={styles.brand}><FlowerMark size={44} className={styles.brandMark} /><span>Heritg</span></div>; }

export function Workspace() {
  const { data, setData, active, updateActive } = useWorkspaceData();
  const { user } = useAuth();
  // Signed-in owners sync through our own API (session cookie); the browser cache keeps working offline.
  const online = Boolean(user);
  const cache = useMemo(() => typeof window !== "undefined" ? new LocalTreeCache(window.localStorage) : null, []);
  const treeRepository = useMemo(() => online ? new HttpTreeRepository() : null, [online]);
  const publicationRepository = useMemo<PublicationRepository | null>(() => online ? new HttpPublicationRepository() : null, [online]);
  // Uploaded photos wait in their own queue and go through the photo endpoint (never inside a tree save).
  const photoQueue = useMemo(() => online && typeof window !== "undefined" ? new PhotoQueue(window.localStorage) : null, [online]);
  const photoClient = useMemo(() => online ? new HttpPhotoClient() : null, [online]);
  const [photoTick, setPhotoTick] = useState(0);
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
  const [renaming, setRenaming] = useState(false);
  const [starting, setStarting] = useState(false);
  const [wizardFor, setWizardFor] = useState<string | null>(null);
  const [editFor, setEditFor] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  // Only one right-hand panel is open at a time.
  const [rightPanel, setRightPanel] = useState<"people" | "settings" | "help" | "privacy" | null>(null);
  const [syncReport, setSyncReport] = useState<SyncReport | null>(null);
  const dialect = useDialect();
  const [deferred, setDeferred] = useState<"Family+" | null>(null);
  const [privacy, setPrivacy] = useState(true);
  const [controlsHidden, setControlsHidden] = useState(false);
  const [viewMenu, setViewMenu] = useState(false);
  // heritg.us opens your own trees in Fokus; the example tree starts in Lengkap.
  const [viewChoice, setView] = useState<"focus" | "full" | null>(null);
  const [focusRoot, setFocusRoot] = useState<string | null>(null);
  const [focusOptions, setFocusOptions] = useState<FocusOptions>(DEFAULT_FOCUS);
  const [legend, setLegend] = useState(false);
  const [panelFor, setPanelFor] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const t = useT();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const view = viewChoice ?? (active && isDemoTree(active) ? "full" : "focus");
  // Fokus explores from the chosen person, else the selected one, else the first person in the tree.
  const rootId = active ? [focusRoot, selected, active.people[0]?.id].find(id => id && active.people.some(person => person.id === id)) ?? null : null;
  const layout = useMemo(() => !active ? null : view === "focus" && rootId ? layoutFocus(active, rootId, focusOptions) : layoutFull(active), [active, view, rootId, focusOptions]);
  const nodes = layout?.nodes ?? [];
  const labelFrom = selected ?? (view === "focus" ? rootId : null);
  const labels = useMemo(() => active && labelFrom && active.relationships.length ? kinshipLabels(active, labelFrom, dialect) : undefined, [active, labelFrom, dialect]);
  const panelPerson = active?.people.find(p => p.id === panelFor) ?? null;
  const activeTreeId = active?.id;
  const activePeopleCount = active?.people.length ?? 0;
  const readOnly = Boolean(active && isDemoTree(active));
  const mappings = cache?.load().migration;
  const remoteTreeId = active && !readOnly && mappings?.completedTreeIds.includes(active.id) ? mappings.remoteIdsByLocalId[active.id] : null;
  const activeOnlineTree = onlineTree?.id === remoteTreeId ? onlineTree : null;
  const migrationPlan = useMemo(() => {
    void migrationVersion; // Re-read durable mappings after a migration run.
    return data && user && cache ? planMigration({ ...data, trees: data.trees.filter(tree => !isDemoTree(tree)) }, cache.load().migration, { ownerId: user.uid }) : null;
  }, [cache, data, migrationVersion, user]);
  const hasPendingMigration = Boolean(migrationPlan?.items.some(item => !item.alreadyCompleted));

  const fitLayout = useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!layout || !layout.nodes.length || !rect?.width || !rect.height) { setZoom(1); setPan({ x: 0, y: 0 }); return; }
    const { minX, maxX, minY, maxY } = layout.bounds;
    const next = Math.max(MIN_ZOOM, Math.min(1.1, (rect.width - 120) / (maxX - minX), (rect.height - 190) / (maxY - minY)));
    setZoom(next);
    setPan({ x: 0, y: 12 });
  }, [layout]);
  const fitKey = `${activeTreeId}|${activePeopleCount}|${view}|${view === "focus" ? rootId : ""}|${focusOptions.siblings}|${focusOptions.ancestorDepth}|${focusOptions.descendantDepth}`;
  // Re-fit when the tree, the view or the Fokus selection changes; editing a person does not move the camera.
  useEffect(() => { fitLayout(); }, [fitKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wheel pans the canvas; Ctrl/⌘ + wheel (and trackpad pinch) zooms. Needs a non-passive listener.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) setZoom(value => clampZoom(value * Math.exp(-event.deltaY / 300)));
      else setPan(value => ({ x: value.x - event.deltaX, y: value.y - event.deltaY }));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [Boolean(data && active)]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data || !active) return <div className={styles.loading}><Brand /><span>{t("shell.loading")}</span></div>;

  const setTree = (tree: FamilyTree) => {
    if (readOnly) return;
    if (photoQueue && remoteTreeId) {
      photoQueue.forgetPeople(remoteTreeId, removedPeople(active, tree));
      const queued = photoTasks(active, tree, remoteTreeId).map(task => photoQueue.set(task));
      if (queued.includes(false)) alert(t("photo.storageFull"));
      setPhotoTick(value => value + 1);
    }
    updateActive(() => tree);
    syncApi.current?.mutate(tree);
  };
  /**
   * Photos embedded in trees that just went online (migration, import, new tree) upload afterwards,
   * same person ids. Only trees completed *in this run*: older ones may have changed on another device.
   * Large images from the first app version are shrunk first so the queue fits in browser storage.
   */
  const queueUploadedTreePhotos = async (localTrees: FamilyTree[], completedBefore: Set<string>) => {
    if (!photoQueue || !cache) return;
    const { completedTreeIds, remoteIdsByLocalId } = cache.load().migration;
    let full = false;
    for (const local of localTrees) {
      const remoteId = remoteIdsByLocalId[local.id];
      if (!remoteId || !completedTreeIds.includes(local.id) || completedBefore.has(local.id)) continue;
      for (const person of local.people) {
        if (!person.photo?.startsWith("data:image/") || person.photoUrl) continue;
        try {
          if (!photoQueue.set({ treeId: remoteId, personId: person.id, action: "upload", dataUrl: await toThumbnailDataUrl(person.photo) })) full = true;
        } catch { /* an unreadable legacy image stays only in the local copy */ }
      }
    }
    if (full) alert(t("photo.storageFull"));
    setPhotoTick(value => value + 1);
  };
  /** A tree from the server, shown with any photo uploads or removals that are still waiting. */
  const localFromOnline = (tree: OnlineTree): FamilyTree => {
    photoQueue?.settle(tree);
    return { ...withPendingPhotos(fromOnlineTree(tree), photoQueue?.list(tree.id) ?? []), id: active.id };
  };
  // Signed in: a new or imported tree goes online immediately. If that fails (e.g. offline) it stays on this device and is offered by the migration prompt next time the app opens.
  const addTree = (tree: FamilyTree) => {
    const next = { ...data, trees: [...data.trees, tree], activeTreeId: tree.id };
    setData(next);
    if (user && treeRepository && cache) {
      const completedBefore = new Set(cache.load().migration.completedTreeIds);
      void uploadNewTree(next, tree.id, user.uid, treeRepository, new LocalCacheMigrationStateStore(cache))
        .then(() => queueUploadedTreePhotos([tree], completedBefore))
        .catch(() => undefined).finally(() => setMigrationVersion(value => value + 1));
    }
  };
  const createTree = () => { addTree(newTree(t("tree.newName", { number: data.trees.length + 1 }))); setSelected(null); setPanelFor(null); setFocusRoot(null); setSidebar(false); };
  const startDrag = (e: ReactPointerEvent<HTMLDivElement>) => { if ((e.target as HTMLElement).closest("button")) return; drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; e.currentTarget.setPointerCapture(e.pointerId); };
  const moveDrag = (e: ReactPointerEvent<HTMLDivElement>) => { if (drag.current) setPan({ x: drag.current.px + e.clientX - drag.current.x, y: drag.current.py + e.clientY - drag.current.y }); };
  const centreOf = (id: string) => { const node = nodes.find(n => n.id === id); if (!node || !layout) return null; return { x: -(node.x - (layout.bounds.minX + layout.bounds.maxX) / 2) * zoom, y: -(node.y - (layout.bounds.minY + layout.bounds.maxY) / 2) * zoom }; };
  const focusPerson = (id: string) => {
    if (view === "focus" && !nodes.some(node => node.id === id)) setFocusRoot(id);
    const centre = centreOf(id);
    if (centre) setPan(centre);
    setSelected(id); setRightPanel(null);
    if (readOnly) setPanelFor(id);
  };
  // Clicking the selected person again clears the selection, like heritg.us.
  const selectPerson = (id: string) => { const next = selected === id ? null : id; setSelected(next); setPanelFor(readOnly ? next : null); };
  const switchView = (next: "focus" | "full") => { setView(next); if (next === "focus" && selected) setFocusRoot(selected); setLegend(false); };
  // The backup embeds uploaded photos as data, so the file stays complete without this account.
  const download = async () => { const blob = new Blob([exportTree(await withEmbeddedPhotos(active))], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${active.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.heritg`; a.click(); URL.revokeObjectURL(url); };
  const loadFile = async (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; try { addTree(importTree(await file.text())); setSidebar(false); } catch (error) { alert(error instanceof Error ? error.message : "Unable to import this file."); } event.target.value = ""; };
  const summary = t("shell.summary", { people: active.people.length, relationships: active.relationships.length });
  const rename = readOnly ? undefined : () => setRenaming(true);
  const selectTree = (id: string) => { setData({ ...data, activeTreeId: id }); setSelected(null); setPanelFor(null); setFocusRoot(null); setView(null); setSidebar(false); };
  // The copy embeds server photos first, so a signed-in owner uploads it with its photos queued (addTree).
  const copyTree = async (tree: FamilyTree) => { const copy = duplicateTree(await withEmbeddedPhotos(tree), t("tree.copyName", { name: tree.name })); addTree(copy); setSelected(null); setPanelFor(null); setFocusRoot(null); setView(null); setSidebar(false); };
  // Renaming works on the active tree (it keeps sync): another tree's menu opens it first.
  const renameFromSidebar = (tree: FamilyTree) => { if (tree.id !== active.id) selectTree(tree.id); setSidebar(false); setRenaming(true); };
  const openPanel = (panel: "privacy" | "help") => { setSidebar(false); setRightPanel(panel); };
  const isEmpty = active.people.length === 0;
  const closeRightPanel = () => setRightPanel(null);

  return <div className={styles.workspace}>
    {!controlsHidden && <>
      <IconButton className={styles.menuButton} label={t("shell.openTrees")} onClick={() => setSidebar(true)}><Menu size={19} /></IconButton>
      <header className={styles.topbar}>
        <div className={styles.titleCard}>
          <div className={styles.titleRow}>
            <button className={styles.titleButton} aria-label={t("shell.renameTreeNamed", { name: active.name })} aria-disabled={readOnly} onClick={rename}><h2>{active.name}</h2></button>
            {!readOnly && <button className={styles.titlePencil} aria-label={t("shell.renameTree")} onClick={rename}><Pencil size={15} aria-hidden="true" /></button>}
          </div>
          <p>{summary}</p>
        </div>
        <div className={styles.topActions}>
          <button className={styles.familyPlusButton} aria-label={t("shell.familyPlus")} onClick={() => setDeferred("Family+")}><CirclePlus size={20} aria-hidden="true" /><span>{t("shell.familyPlus")}</span></button>
          <button className={styles.shareButton} aria-label={t("shell.shareTree")} disabled={!activeOnlineTree || !publicationRepository} onClick={() => setPublishOpen(true)}><Share2 size={17} aria-hidden="true" /><span>{t("shell.share")}</span></button>
          <IconButton label={t("shell.settings")} onClick={() => setRightPanel("settings")}><Settings2 size={19} /></IconButton>
        </div>
      </header>
    </>}

    <div ref={canvasRef} className={styles.canvas} role="region" aria-label={t("canvas.label", { name: active.name })} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={() => drag.current = null} onPointerCancel={() => drag.current = null}>
      {isEmpty || !layout ? <EmptyState onAdd={() => setStarting(true)} onImport={() => importRef.current?.click()} onGuide={() => setRightPanel("help")} /> :
        <div className={styles.stage} style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
          <TreeCanvas tree={active} layout={layout} labels={labels} selectedId={selected} actions={!readOnly} genderLabel={gender => t(`gender.${gender}`)} editLabel={name => t("canvas.edit", { name })} addLabel={name => t("canvas.add", { name })} onSelect={selectPerson} onEdit={setEditFor} onAdd={setWizardFor} style={{ position: "absolute", left: -(layout.bounds.maxX - layout.bounds.minX) / 2, top: -(layout.bounds.maxY - layout.bounds.minY) / 2 }} />
        </div>}
    </div>

    {isEmpty && !readOnly && !controlsHidden && <CoachMarks />}
    {!controlsHidden && <div className={styles.rightControls} role="group" aria-label={t("shell.controls")}>
      <IconButton label={t("shell.allPeople")} onClick={() => setRightPanel("people")}><Users size={19} /></IconButton>
      {view === "full" && <IconButton label={t("shell.branchCount")} disabled><SlidersHorizontal size={18} /></IconButton>}
      <IconButton label={t("shell.zoomIn")} onClick={() => setZoom(z => clampZoom(z * 1.15))}><ZoomIn size={18} /></IconButton>
      <IconButton label={t("shell.zoomOut")} onClick={() => setZoom(z => clampZoom(z / 1.15))}><ZoomOut size={18} /></IconButton>
      <IconButton label={t("shell.fit")} onClick={fitLayout} disabled={isEmpty}><Maximize2 size={18} /></IconButton>
    </div>}
    {!controlsHidden && <div className={styles.bottomRight} role="group" aria-label={t("shell.privacyGroup")}>
      <button className={styles.privacyChip} aria-label={t("shell.privacy", { state: t("shell.privacyProtected") })} onClick={() => setRightPanel("privacy")}><ShieldCheck size={18} aria-hidden="true" /><span>{t("shell.privacyProtected")}</span></button>
      <IconButton label={t("shell.help")} onClick={() => setRightPanel("help")}><CircleHelp size={18} /></IconButton>
    </div>}
    <div className={styles.bottomLeft}>
      <IconButton label={controlsHidden ? t("shell.showControls") : t("shell.hideControls")} onClick={() => { setControlsHidden(value => !value); setViewMenu(false); }}>{controlsHidden ? <EyeOff size={18} /> : <Eye size={18} />}</IconButton>
      {!controlsHidden && <section className={styles.viewMode} aria-label={t("shell.viewMode")}>
        {view === "full" && !isEmpty && <div className={styles.legendWrap}>
          <button className={styles.legendChip} aria-expanded={legend} onClick={() => { setLegend(value => !value); setViewMenu(false); }}><Network size={15} aria-hidden="true" /><span>{t("legend.title")}</span></button>
          {legend && <ul className={styles.legend} aria-label={t("legend.title")}>
            <li><svg width="34" height="10" aria-hidden="true"><path d="M2 5H32" className={styles.legendFamily} /></svg>{t("legend.parentChild")}</li>
            <li><svg width="34" height="10" aria-hidden="true"><path d="M2 5H32" className={styles.legendPartner} /></svg>{t("legend.partner")}</li>
            <li><svg width="34" height="10" aria-hidden="true"><path d="M2 5H32" className={`${styles.legendFamily} ${styles.legendDashed}`} /></svg>{t("legend.nonBiological")}</li>
            <li><svg width="34" height="10" aria-hidden="true"><path d="M2 5H32" className={`${styles.legendPartner} ${styles.legendDashed}`} /></svg>{t("legend.ex")}</li>
          </ul>}
        </div>}
        <button className={styles.viewChip} aria-label={view === "focus" && rootId ? t("shell.viewModeFocusValue", { mode: t("shell.viewFocusLong"), name: displayName(active.people.find(person => person.id === rootId)!) }) : t("shell.viewModeValue", { mode: t(view === "focus" ? "shell.viewFocusLong" : "shell.viewFullLong") })} aria-expanded={viewMenu} onClick={() => { setViewMenu(value => !value); setLegend(false); }}><GitBranch size={16} aria-hidden="true" /><span>{t(view === "focus" ? "shell.viewFocus" : "shell.viewFull")}</span><ChevronDown size={15} aria-hidden="true" /></button>
        {viewMenu && <div className={styles.viewPopover}>
          <div className={styles.segmented} role="group" aria-label={t("shell.viewMode")}>
            <button aria-label={t("shell.viewFocusLong")} aria-pressed={view === "focus"} className={view === "focus" ? styles.segmentActive : ""} disabled={isEmpty} onClick={() => switchView("focus")}>{t("shell.viewFocus")}</button>
            <button aria-label={t("shell.viewFullLong")} aria-pressed={view === "full"} className={view === "full" ? styles.segmentActive : ""} onClick={() => switchView("full")}>{t("shell.viewFull")}</button>
            <button disabled title={t("view.fanSoon")}>{t("shell.viewFan")}</button>
          </div>
          {view === "focus" && rootId && <div className={styles.focusOptions}>
            <label className={styles.explore}><span>{t("view.exploreFrom")}</span><select value={rootId} onChange={event => { setFocusRoot(event.target.value); setSelected(event.target.value); }}>{active.people.map(person => <option key={person.id} value={person.id}>{displayName(person)}</option>)}</select></label>
            <p className={styles.showing}>{t("view.showing", { shown: nodes.length, total: active.people.length })}</p>
            <label className={styles.checkRow}><input type="checkbox" checked={focusOptions.siblings} onChange={event => setFocusOptions(options => ({ ...options, siblings: event.target.checked }))} /><span><strong>{t("view.siblings")}</strong><small>{t("view.siblingsHint")}</small></span></label>
            <div className={styles.depthButtons}>
              <button disabled={!layout || !("moreAncestors" in layout) || !layout.moreAncestors} onClick={() => setFocusOptions(options => ({ ...options, ancestorDepth: options.ancestorDepth + 1 }))}><ArrowUp size={15} aria-hidden="true" />{t("view.moreAncestors")}</button>
              <button disabled={!layout || !("moreDescendants" in layout) || !layout.moreDescendants} onClick={() => setFocusOptions(options => ({ ...options, descendantDepth: options.descendantDepth + 1 }))}><ArrowDown size={15} aria-hidden="true" />{t("view.moreDescendants")}</button>
            </div>
          </div>}
        </div>}
      </section>}
    </div>
    {treeRepository && cache && remoteTreeId && <OnlineTreeBridge key={`${remoteTreeId}-${onlineEpoch}`} treeId={remoteTreeId} repository={treeRepository} cache={cache} apiRef={syncApi} photoQueue={photoQueue} photoClient={photoClient} photoTick={photoTick} onStatus={setSyncReport} onTree={tree => { setOnlineTree(tree); updateActive(() => localFromOnline(tree)); }} />}
    {!remoteTreeId && !controlsHidden && <div className={styles.localStatus}>{readOnly ? t("status.example") : t("status.localOnly")}</div>}

    <input ref={importRef} type="file" accept=".heritg,application/json" hidden onChange={loadFile} />
    {sidebar && <TreeSidebar trees={data.trees} activeId={data.activeTreeId} onClose={() => setSidebar(false)} onSelect={selectTree} onCreate={createTree} onImport={() => importRef.current?.click()} onExport={download} onCopy={copyTree} onRename={renameFromSidebar} onFamilyPlus={() => { setSidebar(false); setDeferred("Family+"); }} onPrivacy={() => openPanel("privacy")} onHelp={() => openPanel("help")} />}
    {renaming && !readOnly && <RenameTreeDialog name={active.name} onClose={() => setRenaming(false)} onSave={name => { setTree({ ...active, name }); setRenaming(false); }} />}
    {panelPerson && <PersonPanel person={panelPerson} relatives={relativesOf(active, panelPerson.id)} readOnly={readOnly} onFocus={focusPerson} onStartOwn={createTree} onClose={() => setPanelFor(null)} onEdit={() => { setEditFor(panelPerson.id); setPanelFor(null); }} onAdd={() => { setWizardFor(panelPerson.id); setPanelFor(null); }} onDelete={() => { setEditFor(panelPerson.id); setPanelFor(null); }} />}
    {starting && !readOnly && <StartDialog onClose={() => setStarting(false)} onSave={person => { setTree({ ...active, people: [...active.people, person], updatedAt: new Date().toISOString() }); setSelected(person.id); setStarting(false); }} />}
    {wizardFor && !readOnly && active.people.some(p => p.id === wizardFor) && <AddRelativeWizard tree={active} anchorId={wizardFor} onClose={() => setWizardFor(null)} onSubmit={input => { const result = addRelative(active, wizardFor, input); setTree(result.tree); setSelected(wizardFor); setWizardFor(null); }} />}
    {editFor && !readOnly && active.people.some(p => p.id === editFor) && <EditProfileDialog key={editFor} tree={active} personId={editFor} onClose={() => setEditFor(null)} onSave={next => { setTree(next); setEditFor(null); }} onDelete={id => { setTree(removePerson(active, id)); setSelected(null); setEditFor(null); }} />}
    {rightPanel === "people" && <PeoplePanel tree={active} selectedId={selected} labels={labels} privacy={privacy && !readOnly} onPick={focusPerson} onClose={closeRightPanel} />}
    {rightPanel === "settings" && <SettingsPanel syncReport={remoteTreeId ? syncReport : null} onFamilyPlus={() => setDeferred("Family+")} onClose={closeRightPanel} />}
    {rightPanel === "help" && <HelpPanel onClose={closeRightPanel} />}
    {rightPanel === "privacy" && <PrivacyPanel masked={privacy} onToggleMask={() => setPrivacy(v => !v)} onClose={closeRightPanel} />}
    {deferred && <Modal title={deferred} onClose={() => setDeferred(null)}><div className={styles.deferredIcon}><Sparkles /></div><h3>Coming in the collaboration release</h3><p>Inviting family editors is planned for a future release. You remain the only owner.</p><button className={styles.primary} onClick={() => setDeferred(null)}>Got it</button></Modal>}
    {publishOpen && activeOnlineTree && publicationRepository && <PublishDialog tree={activeOnlineTree} repository={publicationRepository} onClose={() => setPublishOpen(false)} onTreeChange={tree => { cache?.saveOnlineTree(tree); setOnlineTree(tree); updateActive(() => localFromOnline(tree)); setOnlineEpoch(value => value + 1); }} />}
    {migrationVisible && hasPendingMigration && migrationPlan && treeRepository && cache && <MigrationDialog key={migrationPlan.items.map(item => item.localTreeId).join()} plan={migrationPlan} progress={migrationProgress} result={migrationResult} busy={migrationBusy} onPostpone={() => setMigrationVisible(false)} onMigrate={async treeIds => { setMigrationBusy(true); setMigrationResult(null); const completedBefore = new Set(cache.load().migration.completedTreeIds); try { const result = await runMigration(migrationPlan, treeRepository, new LocalCacheMigrationStateStore(cache), { selectedTreeIds: treeIds, onProgress: setMigrationProgress }); setMigrationResult(result); setMigrationVersion(value => value + 1); void queueUploadedTreePhotos(data.trees, completedBefore); if (!result.failed.length) setMigrationVisible(false); } finally { setMigrationBusy(false); } }} />}
  </div>;
}

function mergeLocalTree(local: FamilyTree, current: OnlineTree): OnlineTree {
  const serialized = toOnlineTree(local, {
    ownerId: current.ownerId,
    visibility: current.visibility,
    publicId: current.publicId,
    revision: current.revision,
    createdAt: current.createdAt,
    publishedRevision: current.publishedRevision,
  });
  return {
    id: current.id, ownerId: serialized.ownerId, name: serialized.name, visibility: serialized.visibility,
    publicId: serialized.publicId, revision: serialized.revision, schemaVersion: serialized.schemaVersion,
    createdAt: serialized.createdAt, updatedAt: serialized.updatedAt, publishedRevision: serialized.publishedRevision,
    people: serialized.people, relationships: serialized.relationships,
  };
}

/** A copy of the tree with server photos fetched and embedded as data URLs (for a portable backup). */
async function withEmbeddedPhotos(tree: FamilyTree): Promise<FamilyTree> {
  const people = await Promise.all(tree.people.map(async person => {
    if (!person.photo?.startsWith("/api/")) return person;
    try {
      const response = await fetch(person.photo, { credentials: "same-origin" });
      if (!response.ok) return { ...person, photo: "" };
      const blob = await response.blob();
      const photo = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob); });
      return { ...person, photo };
    } catch {
      return { ...person, photo: "" };
    }
  }));
  return { ...tree, people };
}

function OnlineTreeBridge({ treeId, repository, cache, apiRef, onTree, onStatus, photoQueue, photoClient, photoTick }: {
  treeId: string;
  repository: TreeRepository;
  cache: LocalTreeCache;
  apiRef: MutableRefObject<{ mutate: (tree: FamilyTree) => void } | null>;
  onTree: (tree: OnlineTree) => void;
  onStatus: (report: SyncReport | null) => void;
  photoQueue: PhotoQueue | null;
  photoClient: HttpPhotoClient | null;
  photoTick: number;
}) {
  const { state, mutate, retry, resolveConflict } = useTreeSync({ treeId, repository, cache });
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoRun = useRef(false);
  const reloadAfterPhotos = useRef(false);
  const [reloadTick, setReloadTick] = useState(0);
  const noPendingSave = state.pendingOperations.length === 0;

  // Once the tree is saved (so every person exists on the server), send waiting photo uploads and
  // removals, then reload the tree to pick up the new photo versions. Offline: stop and try again later.
  useEffect(() => {
    if (!photoQueue || !photoClient || state.status !== "saved" || !state.tree || photoRun.current) return;
    // Reload for new photo versions only between saves, so it can never race a save of the user's own edit.
    if (reloadAfterPhotos.current && noPendingSave) { reloadAfterPhotos.current = false; void retry(); return; }
    const onServer = new Set(state.tree.people.map(person => person.id));
    const tasks = photoQueue.list(treeId).filter(task => !task.done && onServer.has(task.personId));
    if (!tasks.length) return;
    photoRun.current = true;
    void (async () => {
      let changed = false;
      for (const task of tasks) {
        try {
          if (task.action === "upload") photoQueue.markDone(task, await photoClient.upload(treeId, task.personId, await prepareUpload(task.dataUrl)));
          else { await photoClient.remove(treeId, task.personId); photoQueue.markDone(task); }
          changed = true;
        } catch (error) {
          if (error instanceof PhotoRequestError && error.code === "offline") break;
          // Rejected or unreadable: drop it so it cannot block the queue, and say so.
          photoQueue.discard(task);
          setPhotoError(error instanceof Error ? error.message : "A photo could not be saved.");
          changed = true;
        }
      }
      photoRun.current = false;
      if (changed) { reloadAfterPhotos.current = true; setReloadTick(value => value + 1); }
    })();
  }, [noPendingSave, photoClient, photoQueue, photoTick, reloadTick, retry, state.status, state.tree, treeId]);
  const onTreeRef = useRef(onTree);
  onTreeRef.current = onTree;

  useEffect(() => {
    apiRef.current = { mutate: local => { mutate(current => mergeLocalTree(local, current)); } };
    return () => { apiRef.current = null; };
  }, [apiRef, mutate]);
  useEffect(() => { if (state.tree) onTreeRef.current(state.tree); }, [state.tree]);
  const reportedError = state.error ?? photoError;
  useEffect(() => { onStatus({ status: state.status, error: reportedError }); }, [onStatus, state.status, reportedError]);
  useEffect(() => () => onStatus(null), [onStatus]);

  return <>
    <div className={styles.syncStatus}><SyncStatus status={state.status} error={state.error ?? photoError} onRetry={() => { setPhotoError(null); void retry(); }} /></div>
    {state.conflict && <div className={styles.conflictBackdrop}><div className={styles.conflictCard}><ConflictDialog conflict={state.conflict} replaceConfirmationRequired={state.replaceConfirmationRequired} error={state.error} onKeepRemote={() => void resolveConflict("keep-remote")} onReplaceRemote={() => void resolveConflict("replace-remote")} /></div></div>}
  </>;
}

function EmptyState({ onAdd, onImport, onGuide }: { onAdd: () => void; onImport: () => void; onGuide: () => void }) {
  const t = useT();
  return <section className={styles.emptyState}>
    <Brand />
    <h3>{t("empty.title")}</h3>
    <p>{t("empty.body")}</p>
    <div className={styles.emptyOptions}>
      <button onClick={onAdd}><UserPlus size={19} aria-hidden="true" /><span><strong>{t("empty.add")}</strong><small>{t("empty.addHint")}</small></span></button>
      <button onClick={onImport}><FolderOpen size={19} aria-hidden="true" /><span><strong>{t("empty.open")}</strong><small>{t("empty.openHint")}</small></span></button>
      <button onClick={onGuide}><CircleHelp size={19} aria-hidden="true" /><span><strong>{t("empty.guide")}</strong><small>{t("empty.guideHint")}</small></span></button>
    </div>
    <div className={styles.dragHint}><Hand size={15} aria-hidden="true" /><span>{t("empty.drag")}</span></div>
  </section>;
}

function PersonPanel({ person, relatives, readOnly, onFocus, onStartOwn, onClose, onEdit, onAdd, onDelete }: { person: Person; relatives: Relatives; readOnly: boolean; onFocus: (id: string) => void; onStartOwn: () => void; onClose: () => void; onEdit: () => void; onAdd: (relation: "parent-child" | "partner", reverse?: boolean) => void; onDelete: () => void }) {
  const groups = [["Parents", relatives.parents], [relatives.partners.length > 1 ? "Partners" : "Partner", relatives.partners], ["Children", relatives.children]] as const;
  return <Panel title={displayName(person)} onClose={onClose}>
    <div className={styles.profile}><div className={styles.bigAvatar}>{person.photoUrl || person.photo ? <img src={person.photoUrl || person.photo} alt="" /> : displayName(person)[0]}</div><p>{lifeDatesLong(person)}</p>{person.notes && <p className={styles.profileNotes}>{person.notes}</p>}</div>
    {groups.some(([, people]) => people.length > 0) && <dl className={styles.relatives}>{groups.filter(([, people]) => people.length > 0).map(([label, people]) => <div key={label}><dt>{label}</dt><dd>{people.map(relative => <button key={relative.id} onClick={() => onFocus(relative.id)}>{displayName(relative)}</button>)}</dd></div>)}</dl>}
    {readOnly ? <>
      <div className={styles.readOnlyNote}><Lock size={18} aria-hidden="true" /><div><strong>Example tree</strong><p>This sample can’t be edited. Start your own tree to add your family.</p></div></div>
      <button className={styles.primary} onClick={onStartOwn}><Plus size={17} aria-hidden="true" /> Start your own tree</button>
    </> : <>
      <button className={styles.primary} onClick={onEdit}><Pencil size={17} aria-hidden="true" /> Edit details</button><h3 className={styles.panelLabel}>Add a relative</h3><div className={styles.relationGrid}><button onClick={() => onAdd("parent-child", true)}><Plus /> Parent</button><button onClick={() => onAdd("partner")}><Plus /> Partner</button><button onClick={() => onAdd("parent-child")}><Plus /> Child</button></div><button className={styles.danger} onClick={onDelete}>Delete person</button>
    </>}
  </Panel>;
}

function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <aside className={styles.panel}><div className={styles.panelHead}><h2>{title}</h2><IconButton label="Close panel" onClick={onClose}><X /></IconButton></div>{children}</aside>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className={styles.modalBackdrop} onMouseDown={e => e.target === e.currentTarget && onClose()}><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className={styles.panelHead}><h2 id="modal-title">{title}</h2><IconButton label="Close dialog" onClick={onClose}><X /></IconButton></div>{children}</section></div>; }
