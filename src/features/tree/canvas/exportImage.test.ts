import { describe, expect, it } from "vitest";
import type { Person } from "../model";
import { layoutFull } from "./layoutFull";
import { buildTreeSvg, pngSize } from "./exportImage";

const person = (id: string, name: string, extra: Partial<Person> = {}): Person => ({ id, name, gender: "female", birthDate: "", deathDate: "", birthOrder: null, residence: "", notes: "", photoUrl: "", ...extra });
const tree = {
  id: "t", name: "Keluarga <Budi>", updatedAt: "",
  people: [
    person("a", "Siti", { birthDate: "1961-06-21", deathDate: "2020-01-02", photo: "data:image/jpeg;base64,AAAA" }),
    person("b", "Budi", { gender: "male", birthDate: "1960-02-03", photoUrl: "https://example.com/x.jpg" }),
    person("c", "Dewi", { birthDate: "1990-05-05" }),
  ],
  relationships: [
    { id: "r1", type: "partner" as const, from: "a", to: "b", kind: null, status: "married" as const, marriedOn: "" },
    { id: "r2", type: "parent-child" as const, from: "a", to: "c", kind: "biological" as const, status: null, marriedOn: "" },
    { id: "r3", type: "parent-child" as const, from: "b", to: "c", kind: "biological" as const, status: null, marriedOn: "" },
  ],
};
const layout = layoutFull(tree);
const on = { dates: true, photos: true };

describe("buildTreeSvg", () => {
  it("is a standalone SVG with every name, no controls, and an escaped footer", () => {
    const svg = buildTreeSvg(tree, layout, on);
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).toContain("viewBox=");
    for (const name of ["Siti", "Budi", "Dewi"]) expect(svg).toContain(`>${name}<`);
    expect(svg).toContain("Keluarga &lt;Budi&gt;");
    expect(svg).not.toContain("<button");
    expect(svg).not.toContain("foreignObject");
    expect(svg).not.toContain("var(--");
  });

  it("drops dates when off", () => {
    expect(buildTreeSvg(tree, layout, on)).toContain("1961 – 2020");
    const svg = buildTreeSvg(tree, layout, { dates: false, photos: true });
    expect(svg).not.toMatch(/1961|2020|1990/);
  });

  it("embeds only data-URL photos, and none when off", () => {
    const withPhotos = buildTreeSvg(tree, layout, on);
    expect(withPhotos.match(/<image /g)).toHaveLength(1);
    expect(withPhotos).toContain('href="data:image/jpeg;base64,AAAA"');
    expect(withPhotos).not.toContain("example.com");
    expect(buildTreeSvg(tree, layout, { dates: true, photos: false })).not.toContain("<image");
  });
});

describe("pngSize", () => {
  it("scales and caps the long side", () => {
    expect(pngSize(1000, 500, 2)).toEqual({ width: 2000, height: 1000 });
    expect(pngSize(6000, 3000, 2, 8000)).toEqual({ width: 8000, height: 4000 });
    expect(pngSize(1, 1, 2)).toEqual({ width: 2, height: 2 });
  });
});
