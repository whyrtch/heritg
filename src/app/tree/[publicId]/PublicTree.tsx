"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Leaf, Link as LinkIcon } from "lucide-react";
import { connectorPath, displayName, layoutTree, lifespanLabel, type Person } from "@/features/tree/model";
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

function ReadOnlyCanvas({ snapshot }: { snapshot: PublicTreeSnapshot }) {
  const nodes = useMemo(() => layoutTree(snapshot.tree), [snapshot.tree]);
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Brand />
        <div className={styles.title}><h1>{snapshot.name}</h1><p>View only. Published version {snapshot.publishedRevision}</p></div>
        <div className={styles.badge}>Shared by link</div>
      </header>
      <section className={styles.canvas} aria-label={`${snapshot.name} family tree`}>
        {!nodes.length ? <p className={styles.empty}>No family members have been published yet.</p> : (
          <div className={styles.stage}>
            <svg className={styles.lines} aria-hidden="true">
              {snapshot.tree.relationships.map(relationship => {
                const from = nodes.find(node => node.id === relationship.from);
                const to = nodes.find(node => node.id === relationship.to);
                if (!from || !to) return null;
                return <path key={relationship.id} d={connectorPath(from, to, relationship.type)} />;
              })}
            </svg>
            {nodes.map(node => {
              const person = snapshot.tree.people.find(item => item.id === node.id)!;
              return <article key={person.id} className={styles.personCard} style={{ left: node.x, top: node.y }}>
                <Avatar person={person} />
                <span className={styles.personText}>
                  <strong>{displayName(person)}</strong>
                  <small>{lifespanLabel(person)}</small>
                  {person.notes && <em>{person.notes}</em>}
                </span>
              </article>;
            })}
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
