"use client";
import React, { useId, useState } from "react";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { useT } from "@/i18n";
import { displayName, lifeDatesLong, type FamilyTree, type Gender } from "../model";
import { FAN_MAX_GENERATIONS, FAN_MIN_GENERATIONS, layoutFan, type FanSegment } from "./fanLayout";
import styles from "./fanView.module.css";

const SIZES = [{ value: "100%", key: "fan.sizeFit" }, { value: "150%", key: "fan.size150" }, { value: "200%", key: "fan.size200" }] as const;
const GENDER_CLASS: Record<Gender, string> = { male: styles.male, female: styles.female, unspecified: styles.unspecified };
const CHAR_WIDTH = 6.4; // average advance of a 12px label

const clip = (text: string, max: number) => max < 2 ? "" : text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

/** The label that fits the arc: the full name, else the first name, else a shortened one. */
function fitLabel(name: string, arc: number) {
  const max = Math.floor((arc - 8) / CHAR_WIDTH);
  if (name.length <= max) return name;
  return clip(name.split(/\s+/)[0], max);
}

function rootLines(name: string): string[] {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length < 2) return [clip(name, 11)];
  return [clip(words[0], 11), clip(words.slice(1).join(" "), 11)];
}

export type FanViewProps = {
  tree: FamilyTree;
  rootId: string;
  readOnly: boolean;
  /** Re-root on another person (the history of earlier roots is kept here). */
  onRoot: (id: string) => void;
  onBackToTree: () => void;
  onAdd: (id: string) => void;
  onEdit: (id: string) => void;
};

export function FanView({ tree, rootId, readOnly, onRoot, onBackToTree, onAdd, onEdit }: FanViewProps) {
  const t = useT();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [generations, setGenerations] = useState(3);
  const [size, setSize] = useState<string>(SIZES[0].value);
  const [history, setHistory] = useState<string[]>([]);
  const people = new Map(tree.people.map(person => [person.id, person]));
  const root = people.get(rootId);
  if (!root) return null;
  const past = history.filter(id => people.has(id));

  const layout = layoutFan(tree, rootId, generations);
  const rootName = displayName(root);
  const reroot = (id: string) => { if (id === rootId) return; setHistory([...past, rootId]); onRoot(id); };
  const back = () => { const previous = past[past.length - 1]; if (!previous) return; setHistory(past.slice(0, -1)); onRoot(previous); };
  const relationText = (segment: FanSegment) => {
    const ofPerson = people.get(segment.relation.ofId);
    const name = ofPerson ? displayName(ofPerson) : rootName;
    const key = { parent: "fan.relParent", grandparent: "fan.relGrand", ancestor: "fan.relAncestor", child: "fan.relChild" }[segment.relation.kind] as "fan.relParent";
    return t(key, { name });
  };

  const renderSegment = (segment: FanSegment, count: number) => {
    const person = segment.personId ? people.get(segment.personId) : null;
    const midR = Math.hypot(segment.labelX - layout.cx, segment.labelY - layout.cy);
    const arc = midR * (Math.PI / 180) * (180 / count);
    const relation = relationText(segment);
    if (!person) {
      const label = `${t("fan.unrecorded")} · ${relation}`;
      return <g key={segment.key} role="img" aria-label={label}>
        <title>{label}</title>
        <path d={segment.path} className={styles.placeholder} />
      </g>;
    }
    const name = displayName(person);
    const activate = () => reroot(person.id);
    return <g key={segment.key} role="button" tabIndex={0} aria-label={`${name} · ${relation}`} className={styles.segment} onClick={activate} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(); } }}>
      <title>{name}</title>
      <path d={segment.path} className={`${styles.shape} ${GENDER_CLASS[person.gender]}`} />
      <text transform={`translate(${segment.labelX} ${segment.labelY}) rotate(${segment.rotate})`} className={styles.label} textAnchor="middle" dominantBaseline="central" aria-hidden="true">{fitLabel(name, arc)}</text>
    </g>;
  };

  const lines = rootLines(rootName);
  const childCount = layout.children.length;
  const { viewBox } = layout;

  return <div className={styles.page}>
    <div className={styles.content}>
      <nav className={styles.nav} aria-label={t("shell.viewMode")}>
        <button type="button" className={styles.backButton} disabled={!past.length} onClick={back}><ArrowLeft size={18} aria-hidden="true" />{t("fan.back")}</button>
        <button type="button" className={styles.treeButton} onClick={onBackToTree}>{t("fan.backToTree")}</button>
      </nav>
      <h2 className={styles.title}>{t("fan.title")}</h2>
      <p className={styles.intro}>{t("fan.intro")}</p>
      <div className={styles.controls}>
        <label><span>{t("fan.generations")}</span>
          <select value={generations} onChange={event => setGenerations(Number(event.target.value))}>
            {Array.from({ length: FAN_MAX_GENERATIONS - FAN_MIN_GENERATIONS + 1 }, (_, index) => FAN_MIN_GENERATIONS + index).map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label><span>{t("fan.size")}</span>
          <select value={size} onChange={event => setSize(event.target.value)}>
            {SIZES.map(option => <option key={option.value} value={option.value}>{t(option.key)}</option>)}
          </select>
        </label>
      </div>
      <div className={styles.chart} role="region" tabIndex={0} aria-label={t("fan.region")}>
        <svg className={styles.svg} style={{ width: size }} viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`} role="group" aria-label={t("fan.chart", { name: rootName })}>
          <defs><clipPath id={`${uid}-root`}><circle cx={layout.cx} cy={layout.cy} r={layout.rootR - 4} /></clipPath></defs>
          {layout.ancestors.map(segment => renderSegment(segment, 2 ** segment.generation))}
          {childCount > 0 && <g role="group" aria-label={t("fan.relChild", { name: rootName })}>{layout.children.map(segment => renderSegment(segment, childCount))}</g>}
          <g role="img" aria-label={rootName} aria-current="true">
            <title>{rootName}</title>
            <circle cx={layout.cx} cy={layout.cy} r={layout.rootR} className={`${styles.rootShape} ${GENDER_CLASS[root.gender]}`} />
            <g clipPath={`url(#${uid}-root)`} className={styles.rootText} aria-hidden="true">
              {lines.map((line, index) => <text key={index} x={layout.cx} y={layout.cy + (lines.length === 1 ? 0 : index === 0 ? -9.6 : 9.6)} textAnchor="middle" dominantBaseline="central">{line}</text>)}
            </g>
          </g>
        </svg>
      </div>
      <p className={styles.status}>{childCount ? t("fan.children", { count: childCount }) : t("fan.noChildren")}</p>
      <div className={styles.selection}>
        <div className={styles.person}>
          <span className={styles.avatar}>{root.photoUrl || root.photo ? <img src={root.photoUrl || root.photo} alt="" /> : rootName[0]}</span>
          <span className={styles.personText}><strong>{rootName}</strong><small>{lifeDatesLong(root)}</small></span>
        </div>
        {!readOnly && <div className={styles.actions}>
          <button type="button" className={styles.action} aria-label={t("canvas.add", { name: rootName })} title={t("canvas.add", { name: rootName })} onClick={() => onAdd(root.id)}><Plus size={18} aria-hidden="true" /></button>
          <button type="button" className={styles.action} aria-label={t("canvas.edit", { name: rootName })} title={t("canvas.edit", { name: rootName })} onClick={() => onEdit(root.id)}><Pencil size={18} aria-hidden="true" /></button>
        </div>}
      </div>
      <p className={styles.note}>{t("fan.noteExplore")}</p>
      <p className={styles.note}>{t("fan.noteLinks")}</p>
    </div>
  </div>;
}
