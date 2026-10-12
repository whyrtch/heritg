import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "@/i18n";
import { HelpPanel } from "./HelpPanel";
import { PrivacyPanel } from "./PrivacyPanel";

afterEach(() => { cleanup(); setLanguage("id"); window.localStorage.clear(); });

describe("HelpPanel", () => {
  it("shows the intro and the six help items", () => {
    render(<HelpPanel onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "Bantuan" });
    expect(dialog.querySelectorAll("h3")).toHaveLength(6);
    expect(screen.getByRole("heading", { name: "Sinkron dan offline" })).toBeInTheDocument();
    expect(dialog.textContent).toContain("Ctrl/⌘");
  });
});

describe("PrivacyPanel", () => {
  const setup = (masked = true) => {
    const onToggleMask = vi.fn();
    render(<PrivacyPanel masked={masked} onToggleMask={onToggleMask} onClose={vi.fn()} />);
    return { onToggleMask };
  };
  it("shows the status card, five model items and the version line", () => {
    setup();
    const dialog = screen.getByRole("dialog", { name: "Perlindungan privasi" });
    expect(screen.getByText("Data pribadimu cuma buat akun pemilik")).toBeInTheDocument();
    expect(dialog.querySelectorAll("h3")).toHaveLength(5);
    expect(dialog.textContent).toMatch(/Heritg Web \d/);
  });
  it("exposes the masking toggle as aria-pressed and calls back", () => {
    const { onToggleMask } = setup(true);
    const toggle = screen.getByRole("button", { name: "Samarkan tanggal dan foto di daftar" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(toggle);
    expect(onToggleMask).toHaveBeenCalledTimes(1);
  });
  it.each([["id", "terenkripsi di perangkat"], ["en", "encrypted on this device"]] as const)("does not claim device encryption (%s)", (lang, phrase) => {
    setLanguage(lang);
    setup();
    const text = screen.getByRole("dialog").textContent!.toLowerCase();
    expect(text).not.toContain(phrase);
    expect(text).toContain(lang === "id" ? "tidak dienkripsi" : "not encrypted");
  });
});
