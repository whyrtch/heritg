import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "globals.css"), "utf8");
const raw = new Map<string, string>();
for (const match of css.matchAll(/--([a-z-]+):\s*([^;}]+)/g)) raw.set(match[1], match[2].trim());

/** Resolves a token (following var() aliases) to a #rrggbb value. */
function token(name: string): string {
  if (name === "white") return "#ffffff";
  let value = raw.get(name);
  for (let i = 0; i < 5 && value?.startsWith("var("); i++) value = raw.get(value.slice(6, -1));
  if (!value || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`token --${name} is not a hex colour: ${value}`);
  return value;
}
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (fg: string, bg: string) => {
  const [a, b] = [luminance(token(fg)), luminance(token(bg))].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
};

// [foreground, background, minimum ratio]: 4.5 for normal text, 3 for large text and icons.
const PAIRS: Array<[string, string, number]> = [
  ["text", "base", 4.5], ["text", "paper", 4.5], ["text", "recessed", 4.5], ["text", "tree-canvas", 4.5],
  ["subtle", "base", 4.5], ["subtle", "paper", 4.5], ["subtle", "recessed", 4.5], ["subtle", "tree-canvas", 4.5],
  ["brand-deep", "base", 4.5], ["brand-deep", "paper", 4.5], ["brand-deep", "recessed", 4.5],
  ["white", "brand-deep", 4.5], ["white", "family-plus", 4.5], ["white", "family-plus-deep", 4.5],
  ["white", "danger", 4.5], ["white", "add", 4.5], ["white", "soga", 3],
  ["danger", "base", 4.5], ["shield", "base", 4.5], ["shield", "paper", 4.5],
  ["family-plus-deep", "family-plus-soft", 4.5],
];

describe("WCAG AA contrast of the design tokens", () => {
  it.each(PAIRS)("%s on %s is at least %s:1", (fg, bg, min) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(min);
  });
});
