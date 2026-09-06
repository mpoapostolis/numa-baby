import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { t, tAge, tName } from "@/i18n";
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
// Every double-quoted literal in the app, whether it reaches t() directly or
// travels there through a data table (a care card's title, an insight's body).
const LITERALS = new Set<string>(
  [...CODE.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)].map((m) => JSON.parse(`"${m[1]}"`) as string),
);

describe("the Greek dictionary", () => {
  it("has no entry whose English sentence has left the app", () => {
    const orphans = Object.keys(el).filter((key) => !LITERALS.has(key));
    expect(orphans, "these Greek entries answer a sentence no longer in src/ — update or delete them").toEqual([]);
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

  it("fills every hole it is given, and leaves an unknown sentence alone", () => {
    expect(t("{a} and {b}", { a: "1", b: "2" })).toBe("1 and 2");
    expect(t("a sentence nobody wrote")).toBe("a sentence nobody wrote");
  });
});
