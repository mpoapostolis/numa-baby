import { describe, expect, it } from "vitest";
import { parseStoredData } from "@/domain/validate";

// The promise this file exists to keep: nothing a parent ever logged is
// dropped by anything we shipped afterwards. A blob written by the OLDEST
// version of the app — no updatedAt, no deleted, sleep entries, sleep timers
// still open, no burps, no profileUpdatedAt — must come back whole.

const LEGACY_BLOB = JSON.stringify({
  activities: [
    { id: "a1", type: "bottle", startedAt: "2026-07-01T06:10:00.000Z", amount: 90, milkType: "formula" },
    { id: "a2", type: "nursing", startedAt: "2026-07-01T09:00:00.000Z", endedAt: "2026-07-01T09:20:00.000Z", side: "left" },
    { id: "a3", type: "diaper", startedAt: "2026-07-01T10:00:00.000Z", diaperKind: "both" },
    // The retired feature: every one of these must survive.
    { id: "a4", type: "sleep", startedAt: "2026-07-01T13:00:00.000Z", endedAt: "2026-07-01T15:30:00.000Z" },
    { id: "a5", type: "sleep", startedAt: "2026-07-01T22:00:00.000Z", endedAt: "2026-07-02T05:40:00.000Z" },
    { id: "a6", type: "sleep", startedAt: "2026-07-02T13:00:00.000Z" },
    { id: "a7", type: "growth", startedAt: "2026-07-02T08:00:00.000Z", weightGrams: 3820, lengthCm: 51.5, headCm: 35 },
    { id: "a8", type: "health", startedAt: "2026-07-02T20:00:00.000Z", temperatureC: 37.1, note: "a bit warm" },
    { id: "a9", type: "diaper", startedAt: "2026-07-02T21:00:00.000Z" },
  ],
  profile: { name: "Mia", birthDate: "2026-06-20", feedingMode: "mixed" },
  nightMode: true,
  reminders: { feedEnabled: true, feedIntervalMinutes: 180 },
  onboardingComplete: true,
});

describe("a blob written by the oldest version of the app", () => {
  const parsed = parseStoredData(LEGACY_BLOB);

  it("keeps every single entry", () => {
    expect(parsed.activities).toHaveLength(9);
    expect(parsed.activities.map((a) => a.id)).toEqual([
      "a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9",
    ]);
    expect(parsed.droppedActivities).toBe(0);
  });

  it("keeps the retired sleep entries, open timers included", () => {
    const sleeps = parsed.activities.filter((a) => a.type === "sleep");
    expect(sleeps).toHaveLength(3);
    expect(sleeps.find((s) => s.id === "a5")?.endedAt).toBe("2026-07-02T05:40:00.000Z");
    // The one that was never stopped is still there, still open.
    expect(sleeps.find((s) => s.id === "a6")?.endedAt).toBeUndefined();
  });

  it("keeps every field on every entry, untouched", () => {
    const growth = parsed.activities.find((a) => a.id === "a7");
    expect(growth).toMatchObject({ weightGrams: 3820, lengthCm: 51.5, headCm: 35 });
    const health = parsed.activities.find((a) => a.id === "a8");
    expect(health).toMatchObject({ temperatureC: 37.1, note: "a bit warm" });
    const bottle = parsed.activities.find((a) => a.id === "a1");
    expect(bottle).toMatchObject({ amount: 90, milkType: "formula" });
    const nursing = parsed.activities.find((a) => a.id === "a2");
    expect(nursing).toMatchObject({ side: "left", endedAt: "2026-07-01T09:20:00.000Z" });
  });

  it("keeps the profile, the theme and the reminders", () => {
    expect(parsed.profile).toMatchObject({ name: "Mia", birthDate: "2026-06-20", feedingMode: "mixed" });
    expect(parsed.nightMode).toBe(true);
    expect(parsed.reminders).toMatchObject({ feedEnabled: true, feedIntervalMinutes: 180 });
    expect(parsed.onboardingComplete).toBe(true);
  });

  it("does not invent sync metadata on rows that never had it", () => {
    // Legacy rows must come back exactly as written: a migration that stamped
    // updatedAt on load would rewrite history the first time the app opened.
    for (const activity of parsed.activities) {
      expect(activity.updatedAt).toBeUndefined();
      expect(activity.deleted).toBeUndefined();
    }
    expect(parsed.profileUpdatedAt).toBeUndefined();
  });

  it("survives a re-parse of what it would write back", () => {
    const again = parseStoredData(JSON.stringify(parsed));
    expect(again.activities).toHaveLength(9);
    expect(again.droppedActivities).toBe(0);
  });
});

describe("a blob from an unknown future version", () => {
  it("keeps entries carrying fields this version has never heard of", () => {
    const parsed = parseStoredData(JSON.stringify({
      activities: [
        { id: "z1", type: "bottle", startedAt: "2026-07-01T06:10:00.000Z", amount: 90, somethingNew: 42 },
      ],
      profile: { name: "Mia", birthDate: "2026-06-20", feedingMode: "mixed" },
    }));
    expect(parsed.activities).toHaveLength(1);
    expect(parsed.droppedActivities).toBe(0);
  });
});
