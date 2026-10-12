import { displayName, type FamilyTree } from "../model";
import { NODE_INNER_R, NODE_R, type CanvasLayout } from "./layoutFull";

export type ImageOptions = { dates: boolean; photos: boolean };
export type ImageTheme = {
  canvas: string; text: string; subtle: string; brand: string;
  familyLine: string; partnerLine: string;
  maleFill: string; maleStroke: string; femaleFill: string; femaleStroke: string; unspecifiedFill: string; unspecifiedStroke: string;
};

const FONT = `Assistant, system-ui, -apple-system, "Segoe UI", Arial, sans-serif`;
const PAD = 40, FOOTER = 44, NAME_LIMIT = 24, MAX_SIDE = 8000;

const FALLBACK_THEME: ImageTheme = {
  canvas: "#f5f5f3", text: "#302b25", subtle: "#796f63", brand: "#a8875b", familyLine: "#9c825f", partnerLine: "#b47c76",
  maleFill: "#e2ebf2", maleStroke: "#56738d", femaleFill: "#f4e4e8", femaleStroke: "#985c6d", unspecifiedFill: "#ede5d8", unspecifiedStroke: "#9c825f",
};

/** Reads the tree colours from the page's computed CSS variables so an exported file stands alone. */
export function readTheme(root: HTMLElement = document.documentElement): ImageTheme {
  const style = getComputedStyle(root);
  const v = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  const f = FALLBACK_THEME;
  return {
    canvas: v("--tree-canvas", f.canvas), text: v("--text", f.text), subtle: v("--subtle", f.subtle), brand: v("--brand", f.brand),
    familyLine: v("--line-family", f.familyLine), partnerLine: v("--line-partner", f.partnerLine),
    maleFill: v("--male-fill", f.maleFill), maleStroke: v("--male-stroke", f.maleStroke),
    femaleFill: v("--female-fill", f.femaleFill), femaleStroke: v("--female-stroke", f.femaleStroke),
    unspecifiedFill: v("--unspecified-fill", f.unspecifiedFill), unspecifiedStroke: v("--unspecified-stroke", f.unspecifiedStroke),
  };
}

const esc = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const clip = (text: string) => text.length > NAME_LIMIT ? `${text.slice(0, NAME_LIMIT - 1).trimEnd()}…` : text;
const year = (value: string) => value.match(/\d{4}/)?.[0] ?? "";
const dataUrl = (value: string | undefined) => value && /^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/.test(value) ? value : "";

/** "1961 – 2020", "b. 1961" style line from the stored dates, or "" when neither has a year. */
function lifeSpan(birthDate: string, deathDate: string) {
  const b = year(birthDate), d = year(deathDate);
  if (b && d) return `${b} – ${d}`;
  return b || (d ? `† ${d}` : "");
}

/** A standalone SVG document of the layout: circles, connectors, names; no HTML, buttons or actions. */
export function buildTreeSvg(tree: Pick<FamilyTree, "name" | "people">, layout: CanvasLayout, options: ImageOptions, theme: ImageTheme = FALLBACK_THEME): string {
  const { bounds } = layout;
  const x0 = bounds.minX - PAD, y0 = bounds.minY - PAD;
  const width = Math.max(1, Math.round(bounds.maxX - bounds.minX + PAD * 2));
  const height = Math.max(1, Math.round(bounds.maxY - bounds.minY + PAD * 2 + FOOTER));
  const byId = new Map(tree.people.map(person => [person.id, person]));
  const palette = {
    male: [theme.maleFill, theme.maleStroke], female: [theme.femaleFill, theme.femaleStroke], unspecified: [theme.unspecifiedFill, theme.unspecifiedStroke],
  } as const;
  const edges = layout.edges.map(edge => `<path d="${esc(edge.d)}" fill="none" stroke="${edge.type === "partner" ? theme.partnerLine : theme.familyLine}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${edge.dashed ? ` stroke-dasharray="6 6"` : ""}/>`).join("");
  const nodes = layout.nodes.map(node => {
    const person = byId.get(node.id);
    if (!person) return "";
    const [fill, stroke] = palette[person.gender] ?? palette.unspecified;
    const name = displayName(person);
    const photo = options.photos ? dataUrl(person.photo) || dataUrl(person.photoUrl) : "";
    const clipId = `c${node.id.replace(/[^A-Za-z0-9_-]/g, "")}`;
    const span = options.dates ? lifeSpan(person.birthDate, person.deathDate) : "";
    return `<g transform="translate(${node.x} ${node.y})">`
      + `<circle r="${NODE_R}" fill="${fill}" stroke="${stroke}" stroke-width="2"/><circle r="${NODE_INNER_R}" fill="${fill}"/>`
      + (photo
        ? `<clipPath id="${clipId}"><circle r="${NODE_INNER_R}"/></clipPath><image href="${photo}" x="${-NODE_INNER_R}" y="${-NODE_INNER_R}" width="${NODE_INNER_R * 2}" height="${NODE_INNER_R * 2}" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice"/>`
        : `<text y="8.5" text-anchor="middle" font-size="24" font-weight="700" fill="${theme.text}">${esc(name.charAt(0).toUpperCase())}</text>`)
      + `<text y="56" text-anchor="middle" font-size="14" font-weight="700" fill="${theme.text}">${esc(clip(name))}</text>`
      + (span ? `<text y="75" text-anchor="middle" font-size="12" font-weight="500" fill="${theme.subtle}">${esc(span)}</text>` : "")
      + `</g>`;
  }).join("");
  const footer = `<text x="${x0 + width / 2}" y="${y0 + height - 16}" text-anchor="middle" font-size="13" fill="${theme.subtle}">${esc(tree.name)} · Heritg</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x0} ${y0} ${width} ${height}" font-family='${FONT}'>`
    + `<style>text{font-family:${FONT}}</style>`
    + `<rect x="${x0}" y="${y0}" width="${width}" height="${height}" fill="${theme.canvas}"/>`
    + `<g>${edges}</g>${nodes}${footer}</svg>`;
}

/** Pixel size of the PNG: width and height times scale, shrunk so the long side stays within cap. */
export function pngSize(width: number, height: number, scale = 2, cap = MAX_SIDE) {
  const longSide = Math.max(width, height) * scale;
  const factor = longSide > cap ? cap / longSide : 1;
  return { width: Math.max(1, Math.round(width * scale * factor)), height: Math.max(1, Math.round(height * scale * factor)) };
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadSvg(svg: string, filename: string) {
  save(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), filename);
}

export async function downloadPng(svg: string, filename: string, scale = 2) {
  const match = svg.match(/<svg[^>]*\swidth="(\d+)"[^>]*\sheight="(\d+)"/);
  if (!match) throw new Error("bad svg");
  const size = pngSize(Number(match[1]), Number(match[2]), scale);
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("image load failed")); image.src = svgUrl; });
    const canvas = document.createElement("canvas");
    canvas.width = size.width; canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no canvas");
    context.drawImage(image, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("png failed");
    save(blob, filename);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
