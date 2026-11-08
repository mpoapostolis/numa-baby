import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { t, tAge, tAs, tName, tUpper } from "@/i18n";
import el from "@/i18n/el";

// The dictionary's failure mode is silence: change an English sentence in a
// component and its Greek entry is simply never looked up again — the app
// falls back to English and nothing complains. These tests are the complaint.

const SRC = join(import.meta.dirname ?? ".", "..", "..", "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "i18n" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const CODE = sourceFiles(SRC).map((path) => readFileSync(path, "utf8")).join("\n");
// The Worker's error messages reach the screen through t(error.message), so
// a Greek entry for one of them answers a real sentence, not an orphan.
const WORKER = sourceFiles(join(SRC, "..", "worker")).map((path) => readFileSync(path, "utf8")).join("\n");
// Every double-quoted literal in the app, whether it reaches t() directly or
// travels there through a data table (a care card's title, an insight's body).
const LITERALS = new Set<string>(
  [...`${CODE}\n${WORKER}`.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)].map((m) => JSON.parse(`"${m[1]}"`) as string),
);

describe("the Greek dictionary", () => {
  it("has no entry whose English sentence has left the app", () => {
    const orphans = Object.keys(el).filter((key) => !LITERALS.has(key));
    expect(orphans, "these Greek entries answer a sentence no longer in src/ — update or delete them").toEqual([]);
  });

  it("has Greek for every sentence the app writes out in t()", () => {
    // The other half of the orphan test: a sentence wrapped in t() with no
    // entry shows in English to a Greek reader, silently. Sentences that
    // reach t() through a variable are not seen here; the literal ones are
    // nearly all of them.
    const keys = [...CODE.matchAll(/\b(?:t|tAs)\(\s*"((?:[^"\\\n]|\\.)*)"/g)].map((m) => JSON.parse(`"${m[1]}"`) as string);
    const untranslated = [...new Set(keys)].filter((key) => !(key in el));
    expect(untranslated, "these sentences have no Greek yet").toEqual([]);
  });

  it("keeps every {hole} the English sentence declares", () => {
    const holes = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const broken = Object.entries(el)
      .filter(([english, greek]) => holes(english).join() !== holes(greek).join())
      .map(([english]) => english);
    expect(broken, "a hole dropped in translation renders as a gap, or as a literal {name}").toEqual([]);
  });

  it("translates nothing under English, so the domain can be compared and tested", () => {
    expect(t("Good morning")).toBe("Good morning");
    expect(t("{name} is {age} old", { name: "Mia", age: "3 days" })).toBe("Mia is 3 days old");
    // The two seams that rewrite rather than look up stay identity too.
    expect(tAge("2 years 6 months")).toBe("2 years 6 months");
    expect(tName("Mia", "girl")).toBe("Mia");
  });

  it("capitalises a heading without inventing accents English does not have", () => {
    // Under English this is plain toUpperCase; the Greek rule is exercised by
    // the dictionary test below, since the locale here is always "en".
    expect(tUpper("this week")).toBe("THIS WEEK");
  });

  it("shows the bare word for a second meaning, wherever no dictionary has it", () => {
    expect(tAs("Light (how wet)", "Light")).toBe("Light");
  });

  it("fills every hole it is given, and leaves an unknown sentence alone", () => {
    expect(t("{a} and {b}", { a: "1", b: "2" })).toBe("1 and 2");
    expect(t("a sentence nobody wrote")).toBe("a sentence nobody wrote");
  });
});
