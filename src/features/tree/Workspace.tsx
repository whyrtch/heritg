"use client";
import React, { ChangeEvent, FormEvent, MutableRefObject, PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, CircleHelp, CirclePlus, Eye, EyeOff, FileUp, FolderOpen, GitBranch, Hand, Maximize2, Lock, Menu, Network, Pencil, Plus, Search, Settings2, Share2, ShieldCheck, SlidersHorizontal, Sparkles, UserPlus, Users, X, ZoomIn, ZoomOut } from "lucide-react";
import { addRelationship, displayName, emptyPerson, exportTree, FamilyTree, importTree, lifeDatesLong, NAME_MAX, newTree, Person, RESIDENCE_MAX, relativesOf, type Relatives, removePerson } from "./model";
import { isDemoTree } from "./demoData";
import { useT } from "@/i18n";
import { FlowerMark } from "./components/BrandMark";
import { CoachMarks } from "./components/CoachMarks";
import { validatePhotoUrl } from "./domain/photoUrl";
import { fromOnlineTree, toOnlineTree } from "./domain/serialization";
import type { OnlineTree } from "./domain/onlineTypes";
import { TreeCanvas } from "./canvas/TreeCanvas";
import { layoutFull } from "./canvas/layoutFull";
import { DEFAULT_FOCUS, layoutFocus, type FocusOptions } from "./canvas/layoutFocus";
import { kinshipLabels } from "./canvas/kinship";
import { useAuth } from "@/features/auth/useAuth";
import { OwnerSession } from "@/features/auth/OwnerSession";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { FirestoreTreeRepository } from "./repository/FirestoreTreeRepository";
import { LocalTreeCache } from "./repository/LocalTreeCache";
import { FirestorePublicationRepository } from "./publishing/FirestorePublicationRepository";
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

type EditorIntent = { mode: "create" | "edit"; person?: Person; relation?: "parent-child" | "partner"; anchorId?: string; reverse?: boolean };
const IconButton = ({ label, children, onClick, disabled, quiet, className = "" }: { label: string; children: React.ReactNode; onClick?: () => void; disabled?: boolean; quiet?: boolean; className?: string }) => <button className={`${styles.iconButton} ${quiet ? styles.quiet : ""} ${className}`} aria-label={label} title={label} onClick={onClick} disabled={disabled}>{children}</button>;

const MIN_ZOOM = .3, MAX_ZOOM = 1.8;
const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

function Brand() { return <div className={styles.brand}><FlowerMark size={44} className={styles.brandMark} /><span>Heritg</span></div>; }

export function Workspace() {
  const { data, setData, active, updateActive } = useWorkspaceData();
  const { user } = useAuth();
  const online = Boolean(user && isFirebaseConfigured());
  const cache = useMemo(() => typeof window !== "undefined" ? new LocalTreeCache(window.localStorage) : null, []);
  const treeRepository = useMemo(() => online ? new FirestoreTreeRepository() : null, [online]);
  const publicationRepository = useMemo(() => online ? new FirestorePublicationRepository() : null, [online]);
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
  const [editor, setEditor] = useState<EditorIntent | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [directory, setDirectory] = useState(false);
  const [settings, setSettings] = useState(false);
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
  const [help, setHelp] = useState(false);
  const [privacyPanel, setPrivacyPanel] = useState(false);
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
  const labels = useMemo(() => active && labelFrom && active.relationships.length ? kinshipLabels(active, labelFrom) : undefined, [active, labelFrom]);
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

  const setTree = (tree: FamilyTree) => { if (readOnly) return; updateActive(() => tree); syncApi.current?.mutate(tree); };
  // Signed in: a new or imported tree goes online immediately. If that fails (e.g. offline) it stays on this device and is offered by the migration prompt next time the app opens.
  const addTree = (tree: FamilyTree) => {
    const next = { ...data, trees: [...data.trees, tree], activeTreeId: tree.id };
    setData(next);
    if (user && treeRepository && cache) void uploadNewTree(next, tree.id, user.uid, treeRepository, new LocalCacheMigrationStateStore(cache)).catch(() => undefined).finally(() => setMigrationVersion(value => value + 1));
  };
  const createTree = () => { addTree(newTree(t("tree.newName", { number: data.trees.length + 1 }))); setSelected(null); setPanelFor(null); setFocusRoot(null); setSidebar(false); };
  const openEditor = (intent: EditorIntent) => setEditor(intent);
  const startDrag = (e: ReactPointerEvent<HTMLDivElement>) => { if ((e.target as HTMLElement).closest("button")) return; drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; e.currentTarget.setPointerCapture(e.pointerId); };
  const moveDrag = (e: ReactPointerEvent<HTMLDivElement>) => { if (drag.current) setPan({ x: drag.current.px + e.clientX - drag.current.x, y: drag.current.py + e.clientY - drag.current.y }); };
  const centreOf = (id: string) => { const node = nodes.find(n => n.id === id); if (!node || !layout) return null; return { x: -(node.x - (layout.bounds.minX + layout.bounds.maxX) / 2) * zoom, y: -(node.y - (layout.bounds.minY + layout.bounds.maxY) / 2) * zoom }; };
  const focusPerson = (id: string) => {
    if (view === "focus" && !nodes.some(node => node.id === id)) setFocusRoot(id);
    const centre = centreOf(id);
    if (centre) setPan(centre);
    setSelected(id); setDirectory(false);
    if (readOnly) setPanelFor(id);
  };
  // Clicking the selected person again clears the selection, like heritg.us.
  const selectPerson = (id: string) => { const next = selected === id ? null : id; setSelected(next); setPanelFor(readOnly ? next : null); };
  const switchView = (next: "focus" | "full") => { setView(next); if (next === "focus" && selected) setFocusRoot(selected); setLegend(false); };
  const download = () => { const blob = new Blob([exportTree(active)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${active.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.heritg`; a.click(); URL.revokeObjectURL(url); };
  const loadFile = async (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; try { addTree(importTree(await file.text())); setSidebar(false); } catch (error) { alert(error instanceof Error ? error.message : "Unable to import this file."); } event.target.value = ""; };
  const summary = t("shell.summary", { people: active.people.length, relationships: active.relationships.length });
  const rename = readOnly ? undefined : () => { const name = prompt(t("shell.renamePrompt"), active.name); if (name?.trim()) setTree({ ...active, name: name.trim() }); };
  const isEmpty = active.people.length === 0;

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
          <IconButton label={t("shell.settings")} onClick={() => setSettings(true)}><Settings2 size={19} /></IconButton>
        </div>
      </header>
    </>}

    <div ref={canvasRef} className={styles.canvas} role="region" aria-label={t("canvas.label", { name: active.name })} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={() => drag.current = null} onPointerCancel={() => drag.current = null}>
      {isEmpty || !layout ? <EmptyState onAdd={() => openEditor({ mode: "create" })} onImport={() => importRef.current?.click()} onGuide={() => setHelp(true)} /> :
        <div className={styles.stage} style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
          <TreeCanvas tree={active} layout={layout} labels={labels} selectedId={selected} actions={!readOnly} genderLabel={gender => t(`gender.${gender}`)} editLabel={name => t("canvas.edit", { name })} addLabel={name => t("canvas.add", { name })} onSelect={selectPerson} onEdit={id => { const person = active.people.find(p => p.id === id); if (person) openEditor({ mode: "edit", person }); }} onAdd={id => setPanelFor(id)} style={{ position: "absolute", left: -(layout.bounds.maxX - layout.bounds.minX) / 2, top: -(layout.bounds.maxY - layout.bounds.minY) / 2 }} />
        </div>}
    </div>

    {isEmpty && !readOnly && !controlsHidden && <CoachMarks />}
    {!controlsHidden && <div className={styles.rightControls} role="group" aria-label={t("shell.controls")}>
      <IconButton label={t("shell.allPeople")} onClick={() => setDirectory(true)}><Users size={19} /></IconButton>
      {view === "full" && <IconButton label={t("shell.branchCount")} disabled><SlidersHorizontal size={18} /></IconButton>}
      <IconButton label={t("shell.zoomIn")} onClick={() => setZoom(z => clampZoom(z * 1.15))}><ZoomIn size={18} /></IconButton>
      <IconButton label={t("shell.zoomOut")} onClick={() => setZoom(z => clampZoom(z / 1.15))}><ZoomOut size={18} /></IconButton>
      <IconButton label={t("shell.fit")} onClick={fitLayout} disabled={isEmpty}><Maximize2 size={18} /></IconButton>
    </div>}
    {!controlsHidden && <div className={styles.bottomRight} role="group" aria-label={t("shell.privacyGroup")}>
      <button className={styles.privacyChip} aria-label={t("shell.privacy", { state: t("shell.privacyProtected") })} onClick={() => setPrivacyPanel(true)}><ShieldCheck size={18} aria-hidden="true" /><span>{t("shell.privacyProtected")}</span></button>
      <IconButton label={t("shell.help")} onClick={() => setHelp(true)}><CircleHelp size={18} /></IconButton>
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
    {treeRepository && cache && remoteTreeId && <OnlineTreeBridge key={`${remoteTreeId}-${onlineEpoch}`} treeId={remoteTreeId} repository={treeRepository} cache={cache} apiRef={syncApi} onTree={tree => { setOnlineTree(tree); updateActive(() => ({ ...fromOnlineTree(tree), id: active.id })); }} />}
    {!remoteTreeId && !controlsHidden && <div className={styles.localStatus}>{readOnly ? t("status.example") : t("status.localOnly")}</div>}

    <input ref={importRef} type="file" accept=".heritg,application/json" hidden onChange={loadFile} />
    {sidebar && <TreeSidebar data={data} onClose={() => setSidebar(false)} onSelect={id => { setData({ ...data, activeTreeId: id }); setSelected(null); setPanelFor(null); setFocusRoot(null); setView(null); setSidebar(false); }} onCreate={createTree} onImport={() => importRef.current?.click()} onExport={download} onFamilyPlus={() => { setSidebar(false); setDeferred("Family+"); }} />}
    {panelPerson && <PersonPanel person={panelPerson} relatives={relativesOf(active, panelPerson.id)} readOnly={readOnly} onFocus={focusPerson} onStartOwn={createTree} onClose={() => setPanelFor(null)} onEdit={() => openEditor({ mode: "edit", person: panelPerson })} onAdd={(relation, reverse) => openEditor({ mode: "create", relation, anchorId: panelPerson.id, reverse })} onDelete={() => { if (confirm(`Delete ${displayName(panelPerson)}?`)) { setTree(removePerson(active, panelPerson.id)); setSelected(null); setPanelFor(null); } }} />}
    {editor && <PersonEditor intent={editor} onClose={() => setEditor(null)} onSave={(person) => { try { let next = editor.mode === "edit" ? { ...active, people: active.people.map(p => p.id === person.id ? person : p) } : { ...active, people: [...active.people, person] }; if (editor.relation && editor.anchorId) next = addRelationship(next, editor.relation, editor.reverse ? person.id : editor.anchorId, editor.reverse ? editor.anchorId : person.id); // Like heritg.us, adding a relative keeps the person you started from selected.
 setTree(next); setSelected(editor.anchorId ?? person.id); setPanelFor(null); setEditor(null); } catch (error) { alert(error instanceof Error ? error.message : "Could not save person."); } }} />}
    {directory && <Directory tree={active} privacy={privacy && !readOnly} onClose={() => setDirectory(false)} onFocus={focusPerson} />}
    {settings && <Panel title="Settings" onClose={() => setSettings(false)}><div className={styles.settingRow}><div><strong>Privacy protection</strong><p>Mask dates and photos while viewing this device.</p></div><button className={styles.toggle} aria-pressed={privacy} onClick={() => setPrivacy(v => !v)}><span /></button></div><div className={styles.settingRow}><div><strong>Owner account</strong><p>{user?.email ?? "Sign in to sync your trees online."}</p></div><OwnerSession /></div><div className={styles.infoBox}><ShieldCheck /> Online trees sync securely to your owner account. Offline changes remain on this device until connection returns.</div><button className={styles.danger} onClick={() => { if (confirm("Reset cached family trees on this device? Online trees will not be deleted.")) { localStorage.clear(); location.reload(); } }}>Reset device cache</button></Panel>}
    {help && <Panel title={t("shell.help")} onClose={() => setHelp(false)}><p className={styles.helpText}>{t("help.short")}</p></Panel>}
    {privacyPanel && <Panel title={t("privacy.title")} onClose={() => setPrivacyPanel(false)}><p className={styles.helpText}>{t("privacy.body")}</p><div className={styles.settingRow}><div><strong>{t("privacy.maskTitle")}</strong><p>{t("privacy.maskBody")}</p></div><button className={styles.toggle} aria-pressed={privacy} aria-label={t("privacy.maskTitle")} onClick={() => setPrivacy(v => !v)}><span /></button></div></Panel>}
    {deferred && <Modal title={deferred} onClose={() => setDeferred(null)}><div className={styles.deferredIcon}><Sparkles /></div><h3>Coming in the collaboration release</h3><p>Inviting family editors is planned for a future release. You remain the only owner.</p><button className={styles.primary} onClick={() => setDeferred(null)}>Got it</button></Modal>}
    {publishOpen && activeOnlineTree && publicationRepository && <PublishDialog tree={activeOnlineTree} repository={publicationRepository} onClose={() => setPublishOpen(false)} onTreeChange={tree => { cache?.saveOnlineTree(tree); setOnlineTree(tree); updateActive(() => ({ ...fromOnlineTree(tree), id: active.id })); setOnlineEpoch(value => value + 1); }} />}
    {migrationVisible && hasPendingMigration && migrationPlan && treeRepository && cache && <MigrationDialog key={migrationPlan.items.map(item => item.localTreeId).join()} plan={migrationPlan} progress={migrationProgress} result={migrationResult} busy={migrationBusy} onPostpone={() => setMigrationVisible(false)} onMigrate={async treeIds => { setMigrationBusy(true); setMigrationResult(null); try { const result = await runMigration(migrationPlan, treeRepository, new LocalCacheMigrationStateStore(cache), { selectedTreeIds: treeIds, onProgress: setMigrationProgress }); setMigrationResult(result); setMigrationVersion(value => value + 1); if (!result.failed.length) setMigrationVisible(false); } finally { setMigrationBusy(false); } }} />}
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

function OnlineTreeBridge({ treeId, repository, cache, apiRef, onTree }: {
  treeId: string;
  repository: FirestoreTreeRepository;
  cache: LocalTreeCache;
  apiRef: MutableRefObject<{ mutate: (tree: FamilyTree) => void } | null>;
  onTree: (tree: OnlineTree) => void;
}) {
  const { state, mutate, retry, resolveConflict } = useTreeSync({ treeId, repository, cache });
  const onTreeRef = useRef(onTree);
  onTreeRef.current = onTree;

  useEffect(() => {
    apiRef.current = { mutate: local => { mutate(current => mergeLocalTree(local, current)); } };
    return () => { apiRef.current = null; };
  }, [apiRef, mutate]);
  useEffect(() => { if (state.tree) onTreeRef.current(state.tree); }, [state.tree]);

  return <>
    <div className={styles.syncStatus}><SyncStatus status={state.status} error={state.error} onRetry={() => void retry()} /></div>
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

function TreeSidebar({ data, onClose, onSelect, onCreate, onImport, onExport, onFamilyPlus }: { data: ReturnType<typeof useWorkspaceData>["data"] & {}; onClose: () => void; onSelect: (id: string) => void; onCreate: () => void; onImport: () => void; onExport: () => void; onFamilyPlus: () => void }) { return <div className={styles.backdrop} onMouseDown={e => e.target === e.currentTarget && onClose()}><aside className={styles.sidebar}><div className={styles.sidebarHead}><Brand /><p>Your private family archive</p><IconButton label="Close family trees" onClick={onClose}><X /></IconButton></div><div className={styles.sectionTitle}><strong>Family trees</strong><Plus /></div><label className={styles.search}><Search size={18} /><input placeholder="Search trees" /></label><div className={styles.treeList}>{data.trees.map(tree => <button key={tree.id} className={tree.id === data.activeTreeId ? styles.activeTree : ""} onClick={() => onSelect(tree.id)}><strong>{tree.name}</strong><small>{isDemoTree(tree) ? `${tree.people.length} people, example tree` : `${tree.people.length} ${tree.people.length === 1 ? "person" : "people"}, edited ${new Date(tree.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}</small></button>)}</div><button className={styles.sidebarPrimary} onClick={onCreate}><Plus /> New tree</button><button className={styles.sidebarAction} onClick={onImport}><FileUp /> Import file</button><button className={styles.sidebarAction} onClick={onExport}><ChevronDown /> Export current tree</button><hr /><button className={styles.sidebarFamily} onClick={onFamilyPlus}><Sparkles /> <span><strong>Heritg Family+</strong><small>Inviting other editors is coming later</small></span></button><div className={styles.sidebarProtection}><ShieldCheck /><span><strong>Secure sync</strong><small>Online with offline device cache</small></span></div></aside></div>; }

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

function PhotoUrlPreview({ person }: { person: Person }) {
  const [failed, setFailed] = useState(false);
  const url = person.photoUrl.trim();
  useEffect(() => setFailed(false), [url]);
  const initials = person.name.trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join("").toUpperCase() || "?";
  return <div className={styles.photoPreview} aria-label="Photo preview">{url && !failed ? <img src={url} alt="Photo preview" onError={() => setFailed(true)} /> : <span>{initials}</span>}</div>;
}

function PersonEditor({ intent, onClose, onSave }: { intent: EditorIntent; onClose: () => void; onSave: (person: Person) => void }) {
  const t = useT();
  const [person, setPerson] = useState<Person>(intent.person ? { ...intent.person } : emptyPerson());
  const [photoError, setPhotoError] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!person.name.trim()) return;
    const validation = validatePhotoUrl(person.photoUrl);
    if (!validation.ok) { setPhotoError(validation.error); return; }
    onSave({ ...person, name: person.name.trim(), residence: person.residence.trim(), photoUrl: person.photoUrl.trim() });
  };
  const updatePhotoUrl = (value: string) => {
    setPerson(current => ({ ...current, photoUrl: value }));
    const validation = validatePhotoUrl(value);
    setPhotoError(validation.ok ? "" : validation.error);
  };
  return <Modal title={intent.mode === "edit" ? "Edit family member" : "Add family member"} onClose={onClose}><form className={styles.form} onSubmit={submit}>
    <div className={styles.photoUrlRow}><PhotoUrlPreview person={person} /><label>Photo link (optional)<div className={styles.photoInputRow}><input type="url" inputMode="url" placeholder="https://example.com/photo.jpg" aria-invalid={Boolean(photoError)} aria-describedby={photoError ? "photo-url-error" : "photo-url-help"} value={person.photoUrl} onChange={e => updatePhotoUrl(e.target.value)} /><button type="button" disabled={!person.photoUrl} onClick={() => updatePhotoUrl("")}>Remove</button></div><small id="photo-url-help">Use a direct HTTPS image link.</small>{photoError && <small id="photo-url-error" className={styles.fieldError} role="alert">{photoError}</small>}</label></div>
    <label>{t("form.name")}<input autoFocus required maxLength={NAME_MAX} value={person.name} onChange={e => setPerson({ ...person, name: e.target.value })} /></label><div className={styles.twoCols}><label>{t("form.gender")}<select value={person.gender} onChange={e => setPerson({ ...person, gender: e.target.value as Person["gender"] })}><option value="unspecified">{t("gender.unspecified")}</option><option value="female">{t("gender.female")}</option><option value="male">{t("gender.male")}</option></select></label><label>{t("form.residence")}<input maxLength={RESIDENCE_MAX} value={person.residence} onChange={e => setPerson({ ...person, residence: e.target.value })} /></label></div><div className={styles.twoCols}><label>{t("form.birthDate")}<input type="date" value={person.birthDate} onChange={e => setPerson({ ...person, birthDate: e.target.value })} /></label><label>{t("form.deathDate")}<input type="date" value={person.deathDate} onChange={e => setPerson({ ...person, deathDate: e.target.value })} /></label></div><label>{t("form.birthOrder")}<input type="number" min={1} max={99} inputMode="numeric" value={person.birthOrder ?? ""} onChange={e => setPerson({ ...person, birthOrder: e.target.value ? Math.max(1, Math.min(99, Math.round(Number(e.target.value)))) : null })} /><small>{t("form.birthOrderHint")}</small></label><label>{t("form.notes")}<textarea rows={3} maxLength={10000} value={person.notes} onChange={e => setPerson({ ...person, notes: e.target.value })} /></label><div className={styles.formActions}><button type="button" onClick={onClose}>Cancel</button><button className={styles.primary} type="submit">Save person</button></div>
  </form></Modal>;
}

function Directory({ tree, privacy, onClose, onFocus }: { tree: FamilyTree; privacy: boolean; onClose: () => void; onFocus: (id: string) => void }) { const [query, setQuery] = useState(""); const people = tree.people.filter(p => displayName(p).toLowerCase().includes(query.toLowerCase())); return <Panel title="All people" onClose={onClose}><label className={styles.search}><Search /><input autoFocus placeholder="Search people" value={query} onChange={e => setQuery(e.target.value)} /></label><div className={styles.peopleList}>{people.map(p => <button key={p.id} onClick={() => onFocus(p.id)}><span className={styles.smallAvatar}>{(p.photoUrl || p.photo) && !privacy ? <img src={p.photoUrl || p.photo} alt="" /> : displayName(p)[0]}</span><span><strong>{displayName(p)}</strong><small>{privacy ? "Private" : p.birthDate || "Date unknown"}</small></span></button>)}{!people.length && <p className={styles.noResults}>No people found.</p>}</div></Panel>; }
function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <aside className={styles.panel}><div className={styles.panelHead}><h2>{title}</h2><IconButton label="Close panel" onClick={onClose}><X /></IconButton></div>{children}</aside>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className={styles.modalBackdrop} onMouseDown={e => e.target === e.currentTarget && onClose()}><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className={styles.panelHead}><h2 id="modal-title">{title}</h2><IconButton label="Close dialog" onClick={onClose}><X /></IconButton></div>{children}</section></div>; }
