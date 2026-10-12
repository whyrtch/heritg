import { translate, type Language } from "@/i18n";
import type { Person } from "./model";

const LOCALES: Record<Language, string> = { id: "id-ID", en: "en-GB", ms: "ms-MY" };
const formatters = new Map<Language, Intl.DateTimeFormat>();

/** "21 Juni 1961" / "21 June 1961" / "21 Jun 1961" from an ISO date, formatted in UTC so the day never shifts. */
export function formatLongDate(iso: string, language: Language): string {
  let formatter = formatters.get(language);
  if (!formatter) { formatter = new Intl.DateTimeFormat(LOCALES[language], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }); formatters.set(language, formatter); }
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? iso : formatter.format(date);
}

/** "Lahir 21 Juni 1961 · Wafat 23 Juli 2000", or the unknown-birth text. */
export function lifeDatesLong(person: Person, language: Language): string {
  const parts = [
    person.birthDate && translate(language, "life.born", { date: formatLongDate(person.birthDate, language) }),
    person.deathDate && translate(language, "life.died", { date: formatLongDate(person.deathDate, language) }),
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : translate(language, "life.unknown");
}

/** The short year form: "1940 – 2000", "Lahir 1961", "Wafat 2015". */
export function lifespanLabel(person: Person, language: Language): string {
  const born = person.birthDate.slice(0, 4), died = person.deathDate.slice(0, 4);
  if (born && died) return `${born} – ${died}`;
  if (born) return translate(language, "life.yearsBorn", { year: born });
  if (died) return translate(language, "life.yearsDied", { year: died });
  return translate(language, "life.yearsUnknown");
}
