"use client";

import React, { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Leaf, Link as LinkIcon, LockKeyhole } from "lucide-react";
import { TreeCanvas } from "@/features/tree/canvas/TreeCanvas";
import { layoutFull } from "@/features/tree/canvas/layoutFull";
import { t } from "@/i18n";
import { loadPublicTree } from "@/features/tree/publishing/loadPublicTree";
import { WrongPasswordError } from "@/features/tree/domain/secureFile";
import { openProtected } from "@/features/tree/publishing/openProtected";
import { isEncryptedPublicTree, type EncryptedPublicTree, type PublicTreeSnapshot } from "@/features/tree/publishing/PublicationRepository";
import styles from "./publicTree.module.css";

export function PublicTree({
  publicId,
  loader = loadPublicTree,
}: {
  publicId: string;
  loader?: (publicId: string) => Promise<PublicTreeSnapshot | EncryptedPublicTree | null>;
}) {
  const [state, setState] = useState<{ status: "loading" | "ready" | "locked" | "unavailable"; snapshot?: PublicTreeSnapshot; locked?: EncryptedPublicTree }>({ status: "loading" });

  useEffect(() => {
    let current = true;
    setState({ status: "loading" });
    loader(publicId)
      .then(link => { if (current) setState(!link ? { status: "unavailable" } : isEncryptedPublicTree(link) ? { status: "locked", locked: link } : { status: "ready", snapshot: link }); })
      .catch(() => { if (current) setState({ status: "unavailable" }); });
    return () => { current = false; };
  }, [loader, publicId]);

  if (state.status === "loading") return <StatusPage title="Opening family tree…" detail="Loading the shared archive." />;
  if (state.status === "locked" && state.locked) return <PasswordPrompt link={state.locked} onOpen={snapshot => setState({ status: "ready", snapshot })} />;
  if (state.status === "unavailable" || !state.snapshot) return <StatusPage icon title="This family tree is unavailable" detail="The link may be invalid, expired, or no longer shared." />;
  return <ReadOnlyCanvas snapshot={state.snapshot} />;
}

/**
 * The only interactive state of the public page: a password form. Decryption happens here, in the browser; the
 * password is never sent anywhere (there is no request on submit) and is dropped once the tree opens.
 */
function PasswordPrompt({ link, onOpen }: { link: EncryptedPublicTree; onOpen: (snapshot: PublicTreeSnapshot) => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !password) return;
    setBusy(true); setError("");
    try {
      onOpen(await openProtected(link, password));
    } catch (cause) {
      setError(cause instanceof WrongPasswordError ? t("pub.viewWrong") : t("pub.viewDamaged"));
      setBusy(false);
    }
  };
  return <main className={styles.status}>
    <span className={styles.statusIcon}><LockKeyhole aria-hidden="true" /></span>
    <h1>{link.name}</h1>
    <p>{t("pub.viewLocked")}</p>
    <form className={styles.unlock} onSubmit={event => void submit(event)}>
      <label htmlFor="public-password">{t("pub.viewPassword")}</label>
      <input id="public-password" type="password" value={password} autoComplete="off" autoFocus spellCheck={false} aria-invalid={error ? true : undefined} aria-describedby={error ? "public-password-error" : undefined} onChange={event => setPassword(event.target.value)} />
      {error && <p id="public-password-error" role="alert" className={styles.unlockError}>{error}</p>}
      <button type="submit" disabled={busy || !password}>{busy ? t("pub.viewOpening") : t("pub.viewOpen")}</button>
    </form>
    <div className={styles.statusBrand}><Brand /></div>
  </main>;
}

function Brand() { return <div className={styles.brand}><span><Leaf aria-hidden="true" /></span>Heritg</div>; }

/** Smallest scale used on narrow screens; below this names become unreadable, so the canvas scrolls sideways instead. */
const MIN_SCALE = 0.6;
const CANVAS_GUTTER = 48;

function ReadOnlyCanvas({ snapshot }: { snapshot: PublicTreeSnapshot }) {
  const layout = useMemo(() => layoutFull(snapshot.tree), [snapshot.tree]);
  const bounds = useMemo(() => layout.nodes.length ? { width: layout.bounds.maxX - layout.bounds.minX, height: layout.bounds.maxY - layout.bounds.minY } : null, [layout]);
  const canvasRef = useRef<HTMLElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bounds) return;
    const fit = () => setScale(Math.min(1, Math.max(MIN_SCALE, (canvas.clientWidth - CANVAS_GUTTER) / bounds.width)));
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [bounds]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) canvas.scrollLeft = (canvas.scrollWidth - canvas.clientWidth) / 2;
  }, [bounds, scale]);
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Brand />
        <div className={styles.title}><h1>{snapshot.name}</h1><p>{snapshot.publishedRevision > 0 ? `View only. Published version ${snapshot.publishedRevision}` : "View only."}</p></div>
        <div className={styles.badge}>Shared by link</div>
      </header>
      <section ref={canvasRef} className={styles.canvas} aria-label={`${snapshot.name} family tree`}>
        {!bounds ? <p className={styles.empty}>No family members have been published yet.</p> : (
          <div className={styles.stageFrame} style={{ width: bounds.width * scale, height: bounds.height * scale }}>
          <TreeCanvas tree={snapshot.tree} layout={layout} interactive={false} genderLabel={gender => t(`gender.${gender}`)} style={{ position: "absolute", left: 0, top: 0, transformOrigin: "0 0", transform: `scale(${scale})` }} />
          </div>
        )}
      </section>
      <footer>You’re viewing a shared copy kept by the archive owner.</footer>
    </main>
  );
}

function StatusPage({ title, detail, icon = false }: { title: string; detail: string; icon?: boolean }) {
  return <main className={styles.status}>
    {icon && <span className={styles.statusIcon}><LinkIcon aria-hidden="true" /></span>}
    <h1>{title}</h1>
    <p>{detail}</p>
    <div className={styles.statusBrand}><Brand /></div>
  </main>;
}
