import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SilsilahIllustration } from "./SilsilahIllustration";

describe("SilsilahIllustration", () => {
  it.each(["panel", "band", "compact"] as const)("draws a decorative five-generation tree with one highlighted lineage (%s)", variant => {
    const { container } = render(<SilsilahIllustration variant={variant} />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg.querySelectorAll('path[stroke="#d49a66"]')).toHaveLength(4);
    expect(svg.querySelectorAll("circle")).toHaveLength(21);
  });
});
