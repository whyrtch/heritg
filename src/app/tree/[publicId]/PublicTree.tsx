"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Leaf, Link as LinkIcon } from "lucide-react";
import { TreeCanvas } from "@/features/tree/canvas/TreeCanvas";
import { layoutFull } from "@/features/tree/canvas/layoutFull";
import { t } from "@/i18n";
import { loadPublicTree } from "@/features/tree/publishing/loadPublicTree";
import type { PublicTreeSnapshot } from "@/features/tree/publishing/PublicationRepository";
import styles from "./publicTree.module.css";

export function PublicTree({
  publicId,
  loader = loadPublicTree,
}: {
  publicId: string;
  loader?: (publicId: string) => Promise<PublicTreeSnapshot | null>;
}) {
  const [state, setState] = useState<{ status: "loading" | "ready" | "unavailable"; snapshot?: PublicTreeSnapshot }>({ status: "loading" });

  useEffect(() => {
    let current = true;
    setState({ status: "loading" });
    loader(publicId)
      .then(snapshot => { if (current) setState(snapshot ? { status: "ready", snapshot } : { status: "unavailable" }); })
      .catch(() => { if (current) setState({ status: "unavailable" }); });
    return () => { current = false; };
  }, [loader, publicId]);

  if (state.status === "loading") return <StatusPage title="Opening family tree…" detail="Loading the shared archive." />;
  if (state.status === "unavailable" || !state.snapshot) return <StatusPage icon title="This family tree is unavailable" detail="The link may be invalid, expired, or no longer shared." />;
  return <ReadOnlyCanvas snapshot={state.snapshot} />;
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
        <div className={styles.title}><h1>{snapshot.name}</h1><p>View only. Published version {snapshot.publishedRevision}</p></div>
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
