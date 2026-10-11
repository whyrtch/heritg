"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Leaf, Link as LinkIcon } from "lucide-react";
import { CARD_H, CARD_W, connectorPath, displayName, layoutTree, lifespanLabel, type Person } from "@/features/tree/model";
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
  const nodes = useMemo(() => layoutTree(snapshot.tree), [snapshot.tree]);
  const bounds = useMemo(() => {
    if (!nodes.length) return null;
    const xs = nodes.map(node => node.x), ys = nodes.map(node => node.y);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    return { minX, minY, width: Math.max(...xs) - minX + CARD_W, height: Math.max(...ys) - minY + CARD_H };
  }, [nodes]);
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
          <div data-stage className={styles.stage} style={{ width: bounds.width, height: bounds.height, transform: `scale(${scale})` }}>
            <svg className={styles.lines} width={bounds.width} height={bounds.height} viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`} aria-hidden="true">
              {snapshot.tree.relationships.map(relationship => {
                const from = nodes.find(node => node.id === relationship.from);
                const to = nodes.find(node => node.id === relationship.to);
                if (!from || !to) return null;
                return <path key={relationship.id} d={connectorPath(from, to, relationship.type)} />;
              })}
            </svg>
            {nodes.map(node => {
              const person = snapshot.tree.people.find(item => item.id === node.id)!;
              return <article key={person.id} className={styles.personCard} style={{ left: node.x - bounds.minX, top: node.y - bounds.minY }}>
                <Avatar person={person} />
                <span className={styles.personText}>
                  <strong>{displayName(person)}</strong>
                  <small>{lifespanLabel(person)}</small>
                  {person.notes && <em>{person.notes}</em>}
                </span>
              </article>;
            })}
          </div>
          </div>
        )}
      </section>
      <footer>You’re viewing a shared copy kept by the archive owner.</footer>
    </main>
  );
}

function Avatar({ person }: { person: Person }) {
  const [broken, setBroken] = useState(false);
  const initial = displayName(person).charAt(0).toUpperCase();
  return <span className={styles.avatar}>{person.photoUrl && !broken ? <img src={person.photoUrl} alt="" onError={() => setBroken(true)} /> : initial}</span>;
}

function StatusPage({ title, detail, icon = false }: { title: string; detail: string; icon?: boolean }) {
  return <main className={styles.status}>
    {icon && <span className={styles.statusIcon}><LinkIcon aria-hidden="true" /></span>}
    <h1>{title}</h1>
    <p>{detail}</p>
    <div className={styles.statusBrand}><Brand /></div>
  </main>;
}
