import { describe, expect, it } from "vitest";
import { selectPushDelta } from "../../src/domain/syncCursor";
import { Activity } from "../../src/domain/types";

function entry(id: string, updatedAt: string): Activity {
  return { id, type: "bottle", startedAt: updatedAt, updatedAt, amount: 120 };
}

describe("selectPushDelta", () => {
  const cursor = "2026-08-01T00:00:00.000Z";

  it("sends only what was written after the cursor during ordinary logging", () => {
    const delta = selectPushDelta(
      [entry("old", "2026-07-01T00:00:00.000Z"), entry("new", "2026-08-02T00:00:00.000Z")],
      cursor,
      false,
    );
    expect(delta.map((a) => a.id)).toEqual(["new"]);
  });

  it("sends everything on a fresh pairing", () => {
    const all = [entry("a", "2026-07-01T00:00:00.000Z"), entry("b", "2026-07-02T00:00:00.000Z")];
    expect(selectPushDelta(all, "", false)).toHaveLength(2);
  });

  // The bug this module exists for. An imported backup carries the timestamps
  // the entries were first written with, so a plain cursor drops all of it and
  // the partner device never learns those entries exist.
  it("sends imported history whose timestamps predate the cursor", () => {
    const activities = [
      entry("restored-june", "2026-06-14T00:00:00.000Z"),
      entry("restored-july", "2026-07-03T00:00:00.000Z"),
      entry("logged-today", "2026-08-29T00:00:00.000Z"),
    ];

    expect(selectPushDelta(activities, cursor, false).map((a) => a.id)).toEqual(["logged-today"]);

    const afterImport = selectPushDelta(activities, cursor, true);
    expect(afterImport.map((a) => a.id)).toEqual(["restored-june", "restored-july", "logged-today"]);
  });

  it("sends tombstones too, so a deletion made before a restore still travels", () => {
    const deleted: Activity = { ...entry("gone", "2026-06-01T00:00:00.000Z"), deleted: true };
    expect(selectPushDelta([deleted], cursor, true).map((a) => a.id)).toEqual(["gone"]);
  });

  it("treats a missing updatedAt as the entry's start time", () => {
    const legacy: Activity = { id: "legacy", type: "burp", startedAt: "2026-08-05T00:00:00.000Z" };
    expect(selectPushDelta([legacy], cursor, false).map((a) => a.id)).toEqual(["legacy"]);
  });
});
