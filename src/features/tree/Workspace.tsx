"use client";
import { ChangeEvent, FormEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, CircleHelp, Eye, EyeOff, FileUp, Folder, GitBranch, Menu, Minus, MoreHorizontal, Plus, Search, Settings2, Share2, ShieldCheck, SlidersHorizontal, Sparkles, UserPlus, Users, X, ZoomIn } from "lucide-react";
import { addRelationship, displayName, emptyPerson, exportTree, FamilyTree, importTree, layoutTree, newTree, Person, removePerson } from "./model";
import { validatePhotoUrl } from "./domain/photoUrl";
import { useWorkspaceData } from "./useWorkspace";
import styles from "./workspace.module.css";

type EditorIntent = { mode: "create" | "edit"; person?: Person; relation?: "parent-child" | "partner"; anchorId?: string; reverse?: boolean };
const IconButton = ({ label, children, onClick, disabled, className = "" }: { label: string; children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) => <button className={`${styles.iconButton} ${className}`} aria-label={label} title={label} onClick={onClick} disabled={disabled}>{children}</button>;

function Brand() { return <div className={styles.brand}><span className={styles.brandMark}>❈</span><span>Heritg</span></div>; }

export function Workspace() {
  const { data, setData, active, updateActive } = useWorkspaceData();
  const [sidebar, setSidebar] = useState(false);
  const [editor, setEditor] = useState<EditorIntent | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [directory, setDirectory] = useState(false);
  const [settings, setSettings] = useState(false);
  const [deferred, setDeferred] = useState<"Share" | "Family+" | null>(null);
  const [privacy, setPrivacy] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const nodes = useMemo(() => active ? layoutTree(active) : [], [active]);
  const selectedPerson = active?.people.find(p => p.id === selected) ?? null;
  const activeTreeId = active?.id;
  const activePeopleCount = active?.people.length ?? 0;

  useEffect(() => {
    if (!activeTreeId) return;
    setZoom(activePeopleCount > 12 ? .62 : 1);
    setPan(activePeopleCount > 12 ? { x: 0, y: -300 } : { x: 0, y: 0 });
  }, [activePeopleCount, activeTreeId]);

  if (!data || !active) return <div className={styles.loading}><Brand /><span>Opening your archive…</span></div>;

  const setTree = (tree: FamilyTree) => updateActive(() => tree);
  const createTree = () => { const tree = newTree(`Family Tree ${data.trees.length + 1}`); setData({ ...data, trees: [...data.trees, tree], activeTreeId: tree.id }); setSelected(null); setSidebar(false); };
  const openEditor = (intent: EditorIntent) => setEditor(intent);
  const startDrag = (e: ReactPointerEvent<HTMLDivElement>) => { if ((e.target as HTMLElement).closest("button")) return; drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; e.currentTarget.setPointerCapture(e.pointerId); };
  const moveDrag = (e: ReactPointerEvent<HTMLDivElement>) => { if (drag.current) setPan({ x: drag.current.px + e.clientX - drag.current.x, y: drag.current.py + e.clientY - drag.current.y }); };
  const fit = () => { setPan({ x: 0, y: active.people.length > 4 ? -40 : 0 }); setZoom(active.people.length > 8 ? .72 : active.people.length > 4 ? .86 : 1); };
  const focusPerson = (id: string) => { const node = nodes.find(n => n.id === id); if (node) { setPan({ x: -node.x * zoom, y: -node.y * zoom }); setSelected(id); setDirectory(false); } };
  const download = () => { const blob = new Blob([exportTree(active)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${active.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.heritg`; a.click(); URL.revokeObjectURL(url); };
  const loadFile = async (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; try { const tree = importTree(await file.text()); setData({ ...data, trees: [...data.trees, tree], activeTreeId: tree.id }); setSidebar(false); } catch (error) { alert(error instanceof Error ? error.message : "Unable to import this file."); } event.target.value = ""; };

  return <div className={styles.workspace}>
    <header className={styles.topbar}>
      <div className={styles.topLeft}>
        <IconButton label="Show family trees" onClick={() => setSidebar(true)}><Menu size={21} /></IconButton>
        <button className={styles.treeTitle} onClick={() => { const name = prompt("Rename family tree", active.name); if (name?.trim()) setTree({ ...active, name: name.trim() }); }}><strong>{active.name}</strong><span>{active.people.length} {active.people.length === 1 ? "person" : "people"} · {active.relationships.length} relationships</span></button>
      </div>
      <div className={styles.topActions}>
        <button className={styles.familyButton} onClick={() => setDeferred("Family+")}><Sparkles size={18} /> <span>Heritg Family+</span></button>
        <button className={styles.shareButton} onClick={() => setDeferred("Share")}><Share2 size={18} /> <span>Share</span></button>
        <IconButton label="Settings" onClick={() => setSettings(true)}><SlidersHorizontal size={20} /></IconButton>
      </div>
    </header>

    <div className={styles.canvas} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={() => drag.current = null} onPointerCancel={() => drag.current = null}>
      {active.people.length === 0 ? <EmptyState onAdd={() => openEditor({ mode: "create" })} onImport={() => importRef.current?.click()} /> :
        <div className={styles.stage} style={{ transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})` }}>
          <svg className={styles.lines} aria-hidden="true">
            {active.relationships.map(rel => { const from = nodes.find(n => n.id === rel.from), to = nodes.find(n => n.id === rel.to); if (!from || !to) return null; const x1 = from.x + 105, y1 = from.y + 54, x2 = to.x + 105, y2 = to.y + 54; const d = rel.type === "partner" ? `M ${x1} ${y1} L ${x2} ${y2}` : `M ${x1} ${y1 + 54} V ${(y1 + y2) / 2} H ${x2} V ${y2 - 54}`; return <path key={rel.id} d={d} />; })}
          </svg>
          {nodes.map(node => { const person = active.people.find(p => p.id === node.id)!; return <button key={person.id} className={`${styles.personCard} ${selected === person.id ? styles.selected : ""}`} style={{ left: node.x, top: node.y }} onClick={() => setSelected(person.id)}>
            <span className={styles.avatar}>{person.photoUrl || person.photo ? <img src={person.photoUrl || person.photo} alt="" /> : displayName(person).charAt(0).toUpperCase()}</span>
            <span className={styles.personText}><strong>{displayName(person)}</strong><small>{privacy ? "Private" : [person.birthDate, person.deathDate].filter(Boolean).join(" – ") || "Dates unknown"}</small></span><MoreHorizontal size={17} />
          </button>; })}
        </div>}
    </div>

    <aside className={styles.rightControls} aria-label="Canvas controls">
      <IconButton label="All people" onClick={() => setDirectory(true)}><Users size={21} /></IconButton>
      <IconButton label="Branch depth" disabled={!active.people.length}><GitBranch size={20} /></IconButton>
      <IconButton label="Zoom in" onClick={() => setZoom(z => Math.min(1.6, z + .12))}><ZoomIn size={20} /></IconButton>
      <IconButton label="Zoom out" onClick={() => setZoom(z => Math.max(.45, z - .12))}><Minus size={20} /></IconButton>
      <IconButton label="Fit tree" onClick={fit} disabled={!active.people.length}><Settings2 size={19} /></IconButton>
    </aside>
    <div className={styles.bottomLeft}><IconButton label={privacy ? "Reveal private details" : "Protect private details"} onClick={() => setPrivacy(v => !v)}>{privacy ? <Eye size={20} /> : <EyeOff size={20} />}</IconButton></div>
    <div className={styles.bottomRight}><button className={styles.protected} onClick={() => setPrivacy(v => !v)}><ShieldCheck size={18} /> {privacy ? "Protected" : "Visible"}</button><IconButton label="Help" onClick={() => alert("Drag to move the canvas. Use the controls to zoom. Select a person to add family.")}><CircleHelp size={20} /></IconButton></div>
    <button className={styles.mobileAdd} aria-label="Add family member" onClick={() => openEditor({ mode: "create" })}><Plus /></button>

    <input ref={importRef} type="file" accept=".heritg,application/json" hidden onChange={loadFile} />
    {sidebar && <TreeSidebar data={data} onClose={() => setSidebar(false)} onSelect={id => { setData({ ...data, activeTreeId: id }); setSelected(null); setSidebar(false); }} onCreate={createTree} onImport={() => importRef.current?.click()} onExport={download} />}
    {selectedPerson && <PersonPanel person={selectedPerson} onClose={() => setSelected(null)} onEdit={() => openEditor({ mode: "edit", person: selectedPerson })} onAdd={(relation, reverse) => openEditor({ mode: "create", relation, anchorId: selectedPerson.id, reverse })} onDelete={() => { if (confirm(`Delete ${displayName(selectedPerson)}?`)) { setTree(removePerson(active, selectedPerson.id)); setSelected(null); } }} />}
    {editor && <PersonEditor intent={editor} onClose={() => setEditor(null)} onSave={(person) => { try { let next = editor.mode === "edit" ? { ...active, people: active.people.map(p => p.id === person.id ? person : p) } : { ...active, people: [...active.people, person] }; if (editor.relation && editor.anchorId) next = addRelationship(next, editor.relation, editor.reverse ? person.id : editor.anchorId, editor.reverse ? editor.anchorId : person.id); setTree(next); setSelected(person.id); setEditor(null); } catch (error) { alert(error instanceof Error ? error.message : "Could not save person."); } }} />}
    {directory && <Directory tree={active} privacy={privacy} onClose={() => setDirectory(false)} onFocus={focusPerson} />}
    {settings && <Panel title="Settings" onClose={() => setSettings(false)}><div className={styles.settingRow}><div><strong>Privacy protection</strong><p>Mask dates and photos while viewing this device.</p></div><button className={styles.toggle} aria-pressed={privacy} onClick={() => setPrivacy(v => !v)}><span /></button></div><div className={styles.infoBox}><ShieldCheck /> Your tree is saved only in this browser. Export a backup regularly.</div><button className={styles.danger} onClick={() => { if (confirm("Reset all local family trees?")) { localStorage.clear(); location.reload(); } }}>Reset local archive</button></Panel>}
    {deferred && <Modal title={deferred} onClose={() => setDeferred(null)}><div className={styles.deferredIcon}>{deferred === "Share" ? <Share2 /> : <Sparkles />}</div><h3>Coming in the collaboration release</h3><p>{deferred === "Share" ? "Invite links and shared editing will arrive with secure accounts and permissions." : "Cross-device sync and family collaboration are planned for the next release."}</p><button className={styles.primary} onClick={() => setDeferred(null)}>Got it</button></Modal>}
  </div>;
}

function EmptyState({ onAdd, onImport }: { onAdd: () => void; onImport: () => void }) { return <section className={styles.emptyState}><Brand /><h1>Start with anyone</h1><p>Choose any family member: yourself, a parent,<br />grandparent, or ancestor. You can build the tree in<br />any direction.</p><button onClick={onAdd}><UserPlus /><span><strong>Add any family member</strong><small>Start with yourself or an ancestor</small></span></button><button onClick={onImport}><Folder /><span><strong>Open or import a family tree</strong><small>Choose another tree or bring in a .heritg file</small></span></button><button onClick={() => alert("Add someone, then select their card to grow the family in any direction.")}><CircleHelp /><span><strong>Learn the canvas</strong><small>See how to move, zoom, select, and add family</small></span></button><div className={styles.dragHint}>☝ Drag or scroll to move the canvas</div></section>; }

function TreeSidebar({ data, onClose, onSelect, onCreate, onImport, onExport }: { data: ReturnType<typeof useWorkspaceData>["data"] & {}; onClose: () => void; onSelect: (id: string) => void; onCreate: () => void; onImport: () => void; onExport: () => void }) { return <div className={styles.backdrop} onMouseDown={e => e.target === e.currentTarget && onClose()}><aside className={styles.sidebar}><div className={styles.sidebarHead}><Brand /><p>A PRIVATE FAMILY<br />ARCHIVE</p><IconButton label="Close family trees" onClick={onClose}><X /></IconButton></div><div className={styles.sectionTitle}><strong>Family trees</strong><Plus /></div><label className={styles.search}><Search size={18} /><input placeholder="Search trees" /></label><div className={styles.treeList}>{data.trees.map(tree => <button key={tree.id} className={tree.id === data.activeTreeId ? styles.activeTree : ""} onClick={() => onSelect(tree.id)}><strong>{tree.name}</strong><small>{tree.people.length} people · {new Date(tree.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small></button>)}</div><button className={styles.sidebarPrimary} onClick={onCreate}><Plus /> New tree</button><button className={styles.sidebarAction} onClick={onImport}><FileUp /> Import file</button><button className={styles.sidebarAction} onClick={onExport}><ChevronDown /> Export current tree</button><hr /><button className={styles.sidebarFamily}><Sparkles /> <span><strong>Heritg Family+</strong><small>Sync across connected devices</small></span></button><div className={styles.sidebarProtection}><ShieldCheck /><span><strong>Privacy protection</strong><small>Your data is on this device</small></span></div></aside></div>; }

function PersonPanel({ person, onClose, onEdit, onAdd, onDelete }: { person: Person; onClose: () => void; onEdit: () => void; onAdd: (relation: "parent-child" | "partner", reverse?: boolean) => void; onDelete: () => void }) { return <Panel title={displayName(person)} onClose={onClose}><div className={styles.profile}><div className={styles.bigAvatar}>{person.photoUrl || person.photo ? <img src={person.photoUrl || person.photo} alt="" /> : displayName(person)[0]}</div><p>{person.birthDate || "Birth date unknown"}{person.deathDate ? ` — ${person.deathDate}` : ""}</p></div><button className={styles.primary} onClick={onEdit}>Edit details</button><h3 className={styles.panelLabel}>Grow this branch</h3><div className={styles.relationGrid}><button onClick={() => onAdd("parent-child", true)}><Plus /> Parent</button><button onClick={() => onAdd("partner")}><Plus /> Partner</button><button onClick={() => onAdd("parent-child")}><Plus /> Child</button></div><button className={styles.danger} onClick={onDelete}>Delete person</button></Panel>; }

function PhotoUrlPreview({ person }: { person: Person }) {
  const [failed, setFailed] = useState(false);
  const url = person.photoUrl.trim();
  useEffect(() => setFailed(false), [url]);
  const initials = `${person.firstName.charAt(0)}${person.lastName.charAt(0)}`.toUpperCase() || "?";
  return <div className={styles.photoPreview} aria-label="Photo preview">{url && !failed ? <img src={url} alt="Photo preview" onError={() => setFailed(true)} /> : <span>{initials}</span>}</div>;
}

function PersonEditor({ intent, onClose, onSave }: { intent: EditorIntent; onClose: () => void; onSave: (person: Person) => void }) {
  const [person, setPerson] = useState<Person>(intent.person ? { ...intent.person } : emptyPerson());
  const [photoError, setPhotoError] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!person.firstName.trim()) return;
    const validation = validatePhotoUrl(person.photoUrl);
    if (!validation.ok) { setPhotoError(validation.error); return; }
    onSave({ ...person, firstName: person.firstName.trim(), lastName: person.lastName.trim(), photoUrl: person.photoUrl.trim() });
  };
  const updatePhotoUrl = (value: string) => {
    setPerson(current => ({ ...current, photoUrl: value }));
    const validation = validatePhotoUrl(value);
    setPhotoError(validation.ok ? "" : validation.error);
  };
  return <Modal title={intent.mode === "edit" ? "Edit family member" : "Add family member"} onClose={onClose}><form className={styles.form} onSubmit={submit}>
    <div className={styles.photoUrlRow}><PhotoUrlPreview person={person} /><label>Photo link (optional)<div className={styles.photoInputRow}><input type="url" inputMode="url" placeholder="https://example.com/photo.jpg" aria-invalid={Boolean(photoError)} aria-describedby={photoError ? "photo-url-error" : "photo-url-help"} value={person.photoUrl} onChange={e => updatePhotoUrl(e.target.value)} /><button type="button" disabled={!person.photoUrl} onClick={() => updatePhotoUrl("")}>Remove</button></div><small id="photo-url-help">Use a direct HTTPS image link.</small>{photoError && <small id="photo-url-error" className={styles.fieldError} role="alert">{photoError}</small>}</label></div>
    <div className={styles.twoCols}><label>First name<input autoFocus required value={person.firstName} onChange={e => setPerson({ ...person, firstName: e.target.value })} /></label><label>Last name<input value={person.lastName} onChange={e => setPerson({ ...person, lastName: e.target.value })} /></label></div><label>Gender<select value={person.gender} onChange={e => setPerson({ ...person, gender: e.target.value as Person["gender"] })}><option value="unspecified">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="nonbinary">Non-binary</option></select></label><div className={styles.twoCols}><label>Born<input type="date" value={person.birthDate} onChange={e => setPerson({ ...person, birthDate: e.target.value })} /></label><label>Died<input type="date" value={person.deathDate} onChange={e => setPerson({ ...person, deathDate: e.target.value })} /></label></div><label>Notes<textarea rows={3} value={person.notes} onChange={e => setPerson({ ...person, notes: e.target.value })} /></label><div className={styles.formActions}><button type="button" onClick={onClose}>Cancel</button><button className={styles.primary} type="submit">Save person</button></div>
  </form></Modal>;
}

function Directory({ tree, privacy, onClose, onFocus }: { tree: FamilyTree; privacy: boolean; onClose: () => void; onFocus: (id: string) => void }) { const [query, setQuery] = useState(""); const people = tree.people.filter(p => displayName(p).toLowerCase().includes(query.toLowerCase())); return <Panel title="All people" onClose={onClose}><label className={styles.search}><Search /><input autoFocus placeholder="Search people" value={query} onChange={e => setQuery(e.target.value)} /></label><div className={styles.peopleList}>{people.map(p => <button key={p.id} onClick={() => onFocus(p.id)}><span className={styles.smallAvatar}>{(p.photoUrl || p.photo) && !privacy ? <img src={p.photoUrl || p.photo} alt="" /> : displayName(p)[0]}</span><span><strong>{displayName(p)}</strong><small>{privacy ? "Private" : p.birthDate || "Date unknown"}</small></span></button>)}{!people.length && <p className={styles.noResults}>No people found.</p>}</div></Panel>; }
function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <aside className={styles.panel}><div className={styles.panelHead}><h2>{title}</h2><IconButton label="Close panel" onClick={onClose}><X /></IconButton></div>{children}</aside>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className={styles.modalBackdrop} onMouseDown={e => e.target === e.currentTarget && onClose()}><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className={styles.panelHead}><h2 id="modal-title">{title}</h2><IconButton label="Close dialog" onClick={onClose}><X /></IconButton></div>{children}</section></div>; }
