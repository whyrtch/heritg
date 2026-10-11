import { afterEach, describe, expect, it } from "vitest";
import { setLanguage, t, translate } from "./index";

describe("i18n", () => {
  afterEach(() => setLanguage("id"));

  it("defaults to Indonesian and fills placeholders", () => {
    expect(t("shell.summary", { people: 7, relationships: 6 })).toBe("7 orang · 6 hubungan");
  });

  it("switches language and falls back to Indonesian for missing keys", () => {
    setLanguage("en");
    expect(t("shell.share")).toBe("Share");
    expect(t("shell.familyPlus")).toBe("Heritg Family+");
    expect(translate("ms", "shell.zoomIn")).toBe("Zoom In");
  });
});
