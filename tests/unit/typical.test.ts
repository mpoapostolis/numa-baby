import { describe, expect, it } from "vitest";
import { summarizeDay } from "@/domain/daySummary";
import { Activity } from "@/domain/types";
import { typicalVerdict, verdictHeadline } from "@/domain/typical";

// "Is this normal?" — a range, never a target, and never a verdict on a day
// nobody logged.

const DAY = new Date(2026, 7, 25);
const NEXT = new Date(2026, 7, 26, 9).getTime();
const at = (hour: number, minute = 0) => new Date(2026, 7, 25, hour, minute).toISOString();

function day(options: { feeds?: number; wet?: number; dirty?: number; sleepHours?: number }) {
  const log: Activity[] = [];
  for (let i = 0; i < (options.feeds ?? 0); i += 1) {
    log.push({ id: `f${i}`, type: "bottle", startedAt: at(1 + i), amount: 90, milkType: "formula" });
  }
  for (let i = 0; i < (options.wet ?? 0); i += 1) {
    log.push({ id: `w${i}`, type: "diaper", diaperKind: "wet", startedAt: at(2, i * 5) });
  }
  for (let i = 0; i < (options.dirty ?? 0); i += 1) {
    log.push({ id: `d${i}`, type: "diaper", diaperKind: "dirty", startedAt: at(3, i * 5) });
  }
  if (options.sleepHours) {
    log.push({ id: "s0", type: "sleep", startedAt: at(10), endedAt: new Date(2026, 7, 25, 10 + options.sleepHours).toISOString() });
  }
  return summarizeDay(log, DAY, NEXT);
}

describe("typicalVerdict", () => {
  it("calls an ordinary newborn day ordinary, with the page it came from", () => {
    const verdict = typicalVerdict(day({ feeds: 9, wet: 7, dirty: 3, sleepHours: 15 }), 20);
    expect(verdict.ordinary).toBe(true);
    expect(verdict.checks.map((c) => c.id)).toEqual(["feeds", "wet", "dirty", "sleep"]);
    expect(verdict.checks.every((c) => c.source.url.startsWith("https://"))).toBe(true);
    expect(verdict.checks[1].range).toBe("6+");
    expect(verdict.checks[3].range).toBe("14–17h");
    expect(verdictHeadline(verdict, "Mia")).toBe("Yesterday looks ordinary for Mia");
  });

  it("names what sat outside, and never says a word about what to do", () => {
    const verdict = typicalVerdict(day({ feeds: 9, wet: 4, dirty: 3, sleepHours: 15 }), 20);
    expect(verdict.ordinary).toBe(false);
    expect(verdict.checks.find((c) => c.id === "wet")?.within).toBe(false);
    expect(verdictHeadline(verdict, "Mia")).toBe("Yesterday: wet nappies sat outside the usual range");
    // Our own words never instruct — the cited page titles are theirs.
    const ourWords = verdict.checks.map((c) => `${c.label} ${c.note}`).join(" ");
    expect(ourWords).not.toMatch(/should|must|call your|ring your|need to/i);
  });

  it("moves the bands with the baby's age", () => {
    // Six feeds is low for a newborn and ordinary at four months.
    expect(typicalVerdict(day({ feeds: 6 }), 20).checks[0].within).toBe(false);
    expect(typicalVerdict(day({ feeds: 6 }), 120).checks[0].within).toBe(true);
    // A day without a poo: a finding at three weeks, ordinary at three months.
    expect(typicalVerdict(day({ wet: 7, dirty: 0 }), 20).checks.find((c) => c.id === "dirty")?.within).toBe(false);
    const settled = typicalVerdict(day({ wet: 7, dirty: 0 }), 90).checks.find((c) => c.id === "dirty")!;
    expect(settled.within).toBe(true);
    // After six weeks there is no expected number, and "0+" would be a shrug.
    expect(settled.range).toBe("any");
  });

  it("stays silent where the log cannot answer", () => {
    expect(typicalVerdict(day({ feeds: 9 }), null).checks).toHaveLength(0);
    expect(typicalVerdict(undefined, 20).checks).toHaveLength(0);
    expect(typicalVerdict(day({}), 20).checks).toHaveLength(0);
    // A family that logs feeds only is never told its baby sleeps two hours.
    expect(typicalVerdict(day({ feeds: 9, sleepHours: 2 }), 20).checks.map((c) => c.id)).toEqual(["feeds"]);
    // Nappies are read only once the family logs them at all.
    expect(typicalVerdict(day({ feeds: 9 }), 20).checks.map((c) => c.id)).toEqual(["feeds"]);
  });

  it("does not judge the first two days by the sixth day's floor", () => {
    expect(typicalVerdict(day({ wet: 3, dirty: 1 }), 1).checks.find((c) => c.id === "wet")?.within).toBe(true);
    expect(typicalVerdict(day({ wet: 3, dirty: 1 }), 1).checks.find((c) => c.id === "dirty")).toBeUndefined();
  });
});
