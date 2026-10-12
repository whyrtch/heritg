import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FanView } from "./FanView";
import { createJokowiDemoTree } from "../demoData";
import { type FamilyTree } from "../model";

afterEach(cleanup);
const demo = createJokowiDemoTree();
const props = { tree: demo, readOnly: true, onRoot: vi.fn(), onBackToTree: vi.fn(), onAdd: vi.fn(), onEdit: vi.fn() };

describe("FanView", () => {
  it("makes placeholders non-interactive and known people buttons", () => {
    const lone: FamilyTree = { ...demo, people: [{ ...demo.people[0], name: "Sendiri" }], relationships: [] };
    const { container } = render(<FanView {...props} tree={lone} rootId={lone.people[0].id} />);
    const placeholders = screen.getAllByRole("img", { name: /^Belum tercatat · Orang tua dari Sendiri$/ });
    expect(placeholders).toHaveLength(2);
    expect(container.querySelectorAll("[tabindex='0'][role='button']")).toHaveLength(0);
    expect(screen.getByText("Anak belum tercatat")).toBeInTheDocument();
  });

  it("labels grandparents and children, and sets the chart width from the size choice", () => {
    render(<FanView {...props} rootId="jokowi" />);
    expect(screen.getAllByRole("button", { name: / · Kakek\/Nenek dari / }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: / · Anak dari Joko Widodo$/ })).toHaveLength(3);
    const svg = screen.getByRole("group", { name: "Bagan kipas Joko Widodo" });
    fireEvent.change(screen.getByLabelText("Ukuran bagan"), { target: { value: "200%" } });
    expect(svg.style.width).toBe("200%");
  });

  it("offers add and edit only when editable", () => {
    const { rerender } = render(<FanView {...props} rootId="jokowi" readOnly={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Tambah kerabatnya Joko Widodo" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit profil Joko Widodo" }));
    expect(props.onAdd).toHaveBeenCalledWith("jokowi");
    expect(props.onEdit).toHaveBeenCalledWith("jokowi");
    rerender(<FanView {...props} rootId="jokowi" readOnly />);
    expect(screen.queryByRole("button", { name: /^Edit profil/ })).not.toBeInTheDocument();
  });
});
