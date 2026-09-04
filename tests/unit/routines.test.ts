import { describe, expect, it } from "vitest";
import {
  MAX_ROUTINES,
  addRoutine,
  doneToday,
  pendingRoutines,
  removeRoutine,
  sanitizeRoutines,
} from "../../src/domain/routines";
import type { Activity } from "../../src/domain/types";

const vitamin = { id: "r1", label: "Vitamin D" };
const drops = { id: "r2", label: "Iron drops" };

/** A tick, as the app writes one. */
const tick = (routineId: string, at: string): Activity => ({
  id: `a-${routineId}-${at}`,
  type: "routine",
  routineId,
  startedAt: at,
});

const NOON = Date.parse("2026-09-03T12:00:00");

describe("what is still waiting today", () => {
  it("shows everything before anything is ticked", () => {
    expect(pendingRoutines([vitamin, drops], [], NOON)).toEqual([vitamin, drops]);
  });

  it("drops the ones already done, keeping the family's order", () => {
    const log = [tick("r1", "2026-09-03T08:30:00")];
    expect(pendingRoutines([vitamin, drops], log, NOON)).toEqual([drops]);
  });

  it("goes quiet once the list is finished", () => {
    const log = [tick("r1", "2026-09-03T08:30:00"), tick("r2", "2026-09-03T09:00:00")];
    // Empty is what hides the card. That is the whole behaviour: it is there
    // until it is done, and then it is not there.
    expect(pendingRoutines([vitamin, drops], log, NOON)).toEqual([]);
  });

  it("comes back the next day", () => {
    const log = [tick("r1", "2026-09-02T08:30:00"), tick("r2", "2026-09-02T09:00:00")];
    // Yesterday's ticks say nothing about today, which is the entire point of
    // a thing that has to happen every day.
    expect(pendingRoutines([vitamin, drops], log, NOON)).toEqual([vitamin, drops]);
  });

  it("counts by the local calendar day, not by 24 hours", () => {
    // Ticked at half past eleven last night. At one in the morning it is a
    // new day and the list is waiting again — which is right, even though it
    // is only ninety minutes later.
    const log = [tick("r1", "2026-09-02T23:30:00")];
    const oneAm = Date.parse("2026-09-03T01:00:00");
    expect(pendingRoutines([vitamin], log, oneAm)).toEqual([vitamin]);
    // And at ten to midnight it is still done.
    expect(pendingRoutines([vitamin], log, Date.parse("2026-09-02T23:50:00"))).toEqual([]);
  });

  it("ignores everything that is not a tick", () => {
    const log: Activity[] = [
      { id: "b1", type: "bottle", startedAt: "2026-09-03T08:00:00", amount: 90 },
      // A medicine entry is a different thing and must not tick a routine off.
      { id: "m1", type: "medicine", startedAt: "2026-09-03T08:00:00", medicine: "Vitamin D" },
      // A tick for a routine the family has since deleted.
      tick("gone", "2026-09-03T08:00:00"),
    ];
    expect(doneToday(log, NOON)).toEqual(new Set(["gone"]));
    expect(pendingRoutines([vitamin], log, NOON)).toEqual([vitamin]);
  });

  it("has nothing to say when the family keeps no list", () => {
    expect(pendingRoutines([], [tick("r1", "2026-09-03T08:00:00")], NOON)).toEqual([]);
  });
});

describe("keeping the list", () => {
  it("adds one", () => {
    expect(addRoutine([], "Vitamin D", "r1")).toEqual([{ id: "r1", label: "Vitamin D" }]);
    expect(addRoutine([vitamin], "  Iron drops  ", "r2")).toEqual([vitamin, { id: "r2", label: "Iron drops" }]);
  });

  it("refuses a blank, and a duplicate whatever its capitals", () => {
    expect(addRoutine([], "   ", "r1")).toBeNull();
    expect(addRoutine([], 42, "r1")).toBeNull();
    // Two rows reading "Vitamin D" and "vitamin d" are one thing the family
    // then has to tick twice.
    expect(addRoutine([vitamin], "vitamin d", "r9")).toBeNull();
  });

  it("stops at six, because a list nobody finishes never goes away", () => {
    let list = [] as ReturnType<typeof removeRoutine>;
    for (let i = 0; i < MAX_ROUTINES; i += 1) list = addRoutine(list, `Thing ${i}`, `r${i}`)!;
    expect(list).toHaveLength(MAX_ROUTINES);
    expect(addRoutine(list, "One more", "rx")).toBeNull();
  });

  it("removes one", () => {
    expect(removeRoutine([vitamin, drops], "r1")).toEqual([drops]);
    expect(removeRoutine([vitamin], "nope")).toEqual([vitamin]);
  });
});

describe("what arrives from storage or another phone", () => {
  it("keeps what is well formed and drops the rest", () => {
    expect(
      sanitizeRoutines([
        vitamin,
        null,
        "Vitamin D",
        { id: "r3" },
        { label: "no id" },
        { id: "r4", label: "   " },
        { id: "x".repeat(65), label: "too long an id" },
        drops,
      ]),
    ).toEqual([vitamin, drops]);
  });

  it("refuses to be a list, a length or a repeat it did not agree to", () => {
    expect(sanitizeRoutines("Vitamin D")).toEqual([]);
    expect(sanitizeRoutines(undefined)).toEqual([]);
    // The same id twice would render two rows that tick each other off.
    expect(sanitizeRoutines([vitamin, { id: "r1", label: "Something else" }])).toEqual([vitamin]);
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `r${i}`, label: `Thing ${i}` }));
    expect(sanitizeRoutines(many)).toHaveLength(MAX_ROUTINES);
  });

  it("trims a label somebody made very long", () => {
    const [only] = sanitizeRoutines([{ id: "r1", label: "x".repeat(200) }]);
    expect(only.label.length).toBe(32);
  });
});
