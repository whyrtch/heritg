"use client";

import React, { useState, type CSSProperties } from "react";
import { Pencil, Plus } from "lucide-react";
import { displayName, type FamilyTree, type Gender, type Person } from "../model";
import { NODE_INNER_R, NODE_R, type CanvasLayout } from "./layoutFull";
import styles from "./treeCanvas.module.css";

export type TreeCanvasProps = {
  tree: Pick<FamilyTree, "people">;
  layout: CanvasLayout;
  /** Relation of each person to the selected person ("Ayah", "Istri", …). */
  labels?: Map<string, string>;
  selectedId?: string | null;
  /** Without interaction (public viewer) nothing is focusable and no buttons are rendered. */
  interactive?: boolean;
  /** Show the add / edit action dots next to the selected person. */
  actions?: boolean;
  genderLabel: (gender: Gender) => string;
  editLabel?: (name: string) => string;
  addLabel?: (name: string) => string;
  onSelect?: (id: string) => void;
  onEdit?: (id: string) => void;
  onAdd?: (id: string) => void;
  style?: CSSProperties;
  className?: string;
};

const NAME_LIMIT = 24;
const clip = (text: string) => text.length > NAME_LIMIT ? `${text.slice(0, NAME_LIMIT - 1).trimEnd()}…` : text;
const HIT_W = 104, HIT_TOP = 38, HIT_H = 124;
// Action dots sit side by side left of the selected node (measured on heritg.us: add at -61, edit at -95).
const ADD_DOT_X = -61, EDIT_DOT_X = -95, DOT_HIT_W = 34, DOT_HIT_H = 44;

/** The heritg.us-style family canvas: SVG circles and connectors, with invisible HTML buttons for access. */
export function TreeCanvas({ tree, layout, labels, selectedId = null, interactive = true, actions = false, genderLabel, editLabel, addLabel, onSelect, onEdit, onAdd, style, className }: TreeCanvasProps) {
  const { bounds } = layout;
  const width = bounds.maxX - bounds.minX, height = bounds.maxY - bounds.minY;
  const byId = new Map(tree.people.map(person => [person.id, person]));
  const selectedNode = layout.nodes.find(node => node.id === selectedId) ?? null;
  const selectedPerson = selectedNode ? byId.get(selectedNode.id) ?? null : null;
  const left = (x: number) => x - bounds.minX, top = (y: number) => y - bounds.minY;
  const dot = (x: number) => selectedNode ? { left: left(selectedNode.x) + x - DOT_HIT_W / 2, top: top(selectedNode.y) - DOT_HIT_H / 2, width: DOT_HIT_W, height: DOT_HIT_H } : undefined;
  return <div data-stage className={`${styles.stage} ${className ?? ""}`} style={{ width, height, ...style }}>
    <svg className={styles.svg} width={width} height={height} viewBox={`${bounds.minX} ${bounds.minY} ${width} ${height}`} aria-hidden="true">
      <g className={styles.edges}>
        {layout.edges.map(edge => <path key={edge.id} d={edge.d} className={`${edge.type === "partner" ? styles.partnerLine : styles.familyLine} ${edge.dashed ? styles.dashed : ""}`} />)}
      </g>
      {layout.nodes.map(node => {
        const person = byId.get(node.id);
        return person ? <PersonNode key={node.id} person={person} x={node.x} y={node.y} label={labels?.get(node.id) ?? ""} selected={node.id === selectedId} /> : null;
      })}
    </svg>
    {interactive && layout.nodes.map(node => {
      const person = byId.get(node.id);
      if (!person) return null;
      const name = displayName(person);
      return <button key={node.id} type="button" className={styles.hit} style={{ left: left(node.x) - HIT_W / 2, top: top(node.y) - HIT_TOP, width: HIT_W, height: HIT_H }} aria-label={`${name}, ${genderLabel(person.gender)}`} aria-pressed={node.id === selectedId} onClick={() => onSelect?.(node.id)} />;
    })}
    {interactive && actions && selectedNode && selectedPerson && <>
      <button type="button" className={`${styles.dot} ${styles.addDot}`} style={dot(ADD_DOT_X)} aria-label={addLabel?.(displayName(selectedPerson))} onClick={() => onAdd?.(selectedNode.id)}><span><Plus size={16} aria-hidden="true" /></span></button>
      <button type="button" className={`${styles.dot} ${styles.editDot}`} style={dot(EDIT_DOT_X)} aria-label={editLabel?.(displayName(selectedPerson))} onClick={() => onEdit?.(selectedNode.id)}><span><Pencil size={14} aria-hidden="true" /></span></button>
    </>}
  </div>;
}

function PersonNode({ person, x, y, label, selected }: { person: Person; x: number; y: number; label: string; selected: boolean }) {
  const [broken, setBroken] = useState(false);
  const photo = person.photoUrl || person.photo || "";
  const name = displayName(person);
  const clipId = `node-clip-${person.id.replace(/[^A-Za-z0-9_-]/g, "")}`;
  return <g transform={`translate(${x} ${y})`} className={`${styles.node} ${styles[person.gender]} ${selected ? styles.selected : ""}`}>
    <circle r={NODE_R} className={styles.ring} />
    <circle r={NODE_INNER_R} className={styles.inner} />
    {photo && !broken
      ? <><clipPath id={clipId}><circle r={NODE_INNER_R} /></clipPath><image href={photo} x={-NODE_INNER_R} y={-NODE_INNER_R} width={NODE_INNER_R * 2} height={NODE_INNER_R * 2} clipPath={`url(#${clipId})`} preserveAspectRatio="xMidYMid slice" onError={() => setBroken(true)} /></>
      : <text className={styles.initial} y={8.5} textAnchor="middle">{name.charAt(0).toUpperCase()}</text>}
    <text className={styles.name} y={56} textAnchor="middle">{clip(name)}</text>
    {label && <text className={styles.relation} y={77} textAnchor="middle">{label}</text>}
  </g>;
}
