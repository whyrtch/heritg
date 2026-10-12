import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "@/i18n";
import { setDialect } from "../canvas/dialectSetting";
import { SettingsPanel, syncPill, type SyncReport } from "./SettingsPanel";

const auth = vi.hoisted(() => ({ user: null as { email: string; uid: string } | null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/features/auth/useAuth", () => ({ useAuth: () => ({ user: auth.user, status: auth.user ? "authenticated" : "unauthenticated", signOut: vi.fn() }) }));

beforeEach(() => { auth.user = null; });
afterEach(() => { cleanup(); setLanguage("id"); setDialect("id"); window.localStorage.clear(); });

const report = (status: SyncReport["status"], error: string | null = null): SyncReport => ({ status, error });

describe("syncPill", () => {
  it("maps every sync state", () => {
    expect(syncPill(report("saved"), true)).toBe("saved");
    expect(syncPill(report("saving"), true)).toBe("saving");
    expect(syncPill(report("loading"), true)).toBe("saving");
    expect(syncPill(report("public-stale"), true)).toBe("saved");
    expect(syncPill(report("offline"), true)).toBe("offline");
    expect(syncPill(report("conflict"), true)).toBe("check");
    expect(syncPill(report("saved", "boom"), true)).toBe("check");
    expect(syncPill(null, true)).toBe("local");
    expect(syncPill(report("saved"), false)).toBe("local");
  });
});

describe("SettingsPanel", () => {
  const open = (syncReport: SyncReport | null = null) => render(<SettingsPanel syncReport={syncReport} onFamilyPlus={vi.fn()} onClose={vi.fn()} />);

  it("shows the signed-out copy and a local-only sync pill", () => {
    open();
    expect(screen.getByText("Belum masuk")).toBeInTheDocument();
    expect(screen.getByText("Belum aktif")).toBeInTheDocument();
    expect(screen.getByText("Cuma di perangkat ini")).toBeInTheDocument();
  });

  it("shows the owner email, Aktif and the saved pill when signed in", () => {
    auth.user = { email: "owner@example.com", uid: "u1" };
    open(report("saved"));
    expect(screen.getByText("owner@example.com")).toBeInTheDocument();
    expect(screen.getByText("Aktif")).toBeInTheDocument();
    expect(screen.getByText("Tersimpan")).toBeInTheDocument();
  });

  it("switches the language when English is chosen", () => {
    open();
    const group = () => within(screen.getByRole("region", { name: /Bahasa aplikasi|App language/ }));
    expect(group().getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(group().getByRole("button", { name: "English" }));
    expect(screen.getByText("Family+ access")).toBeInTheDocument();
    expect(group().getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onFamilyPlus from the gradient button", () => {
    const onFamilyPlus = vi.fn();
    render(<SettingsPanel syncReport={null} onFamilyPlus={onFamilyPlus} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Lihat Family+" }));
    expect(onFamilyPlus).toHaveBeenCalled();
  });

  it("stores the chosen kinship dialect", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Basa Jawa (Yogyakarta)" }));
    expect(screen.getByRole("button", { name: "Basa Jawa (Yogyakarta)" })).toHaveAttribute("aria-pressed", "true");
    expect(window.localStorage.getItem("heritg.kinshipDialect")).toBe("jv-yogya");
  });
});
