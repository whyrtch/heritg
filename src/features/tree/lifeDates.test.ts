import { describe, expect, it } from "vitest";
import { emptyPerson } from "./model";
import { formatLongDate, lifeDatesLong, lifespanLabel } from "./lifeDates";

const p = (birthDate = "", deathDate = "") => ({ ...emptyPerson(), birthDate, deathDate });

describe("localized life dates", () => {
  it("formats long dates per language without timezone drift", () => {
    expect(formatLongDate("1961-06-21", "id")).toBe("21 Juni 1961");
    expect(formatLongDate("1961-06-21", "en")).toBe("21 June 1961");
    expect(formatLongDate("1961-06-21", "ms")).toBe("21 Jun 1961");
  });
  it("writes birth and death dates in each language", () => {
    expect(lifeDatesLong(p("1961-06-21"), "id")).toBe("Lahir 21 Juni 1961");
    expect(lifeDatesLong(p("1961-06-21"), "en")).toBe("Born 21 June 1961");
    expect(lifeDatesLong(p("1961-06-21"), "ms")).toBe("Lahir 21 Jun 1961");
    expect(lifeDatesLong(p("1940-12-30", "2000-07-23"), "en")).toBe("Born 30 December 1940 · Died 23 July 2000");
    expect(lifeDatesLong(p("1940-12-30", "2000-07-23"), "id")).toBe("Lahir 30 Desember 1940 · Wafat 23 Juli 2000");
    expect(lifeDatesLong(p(), "en")).toBe("Birth date unknown");
    expect(lifeDatesLong(p(), "id")).toBe("Tanggal lahir belum diketahui");
  });
  it("labels lifespans by year", () => {
    expect(lifespanLabel(p("1961-06-21"), "en")).toBe("Born 1961");
    expect(lifespanLabel(p("1940-12-30", "2000-07-23"), "id")).toBe("1940 – 2000");
    expect(lifespanLabel(p("", "2015-10-23"), "id")).toBe("Wafat 2015");
    expect(lifespanLabel(p(), "ms")).toBe("Tahun tidak diketahui");
  });
});
