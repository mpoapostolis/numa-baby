import { expect, test } from "vitest";
import { applyRemote, mergeActivities, mergeStored, summarizeMerge } from "@/domain/merge";
import { Activity, Profile } from "@/domain/types";

// The merge-on-import truth table. Import must be a union, never a replace:
// nothing a parent logged can be lost to a stale backup, deletions must hold,
// and the result must not depend on which device merges first.

function at(minutes: number) {
  return new Date(Date.UTC(2026, 6, 1, 8, minutes)).toISOString();
}

function entry(id: string, overrides: Partial<Activity> = {}): Activity {
  return { id, type: "diaper", diaperKind: "wet", startedAt: at(0), updatedAt: at(10), ...overrides };
}

// A legacy row carries NO updatedAt key at all — not an explicit undefined.
function legacyEntry(id: string, overrides: Partial<Activity> = {}): Activity {
  const value = entry(id, overrides);
  delete value.updatedAt;
  return value;
}

test("disjoint sets union to every entry from both sides", () => {
  const local = [entry("a", { updatedAt: at(1) }), entry("b", { updatedAt: at(2) })];
  const incoming = [entry("c", { updatedAt: at(3) }), entry("d", { updatedAt: at(4) })];
  const merged = mergeActivities(local, incoming);
  expect(merged.map((item) => item.id).sort()).toEqual(["a", "b", "c", "d"]);
  expect(mergeActivities(incoming, local)).toStrictEqual(merged);
});

test("same id: the newer incoming copy wins", () => {
  const local = [entry("a", { note: "stale", updatedAt: at(1) })];
  const incoming = [entry("a", { note: "fresh", updatedAt: at(2) })];
  expect(mergeActivities(local, incoming)).toStrictEqual([entry("a", { note: "fresh", updatedAt: at(2) })]);
});

test("same id: the newer local copy wins", () => {
  const local = [entry("a", { note: "fresh", updatedAt: at(9) })];
  const incoming = [entry("a", { note: "stale", updatedAt: at(4) })];
  expect(mergeActivities(local, incoming)).toStrictEqual([entry("a", { note: "fresh", updatedAt: at(9) })]);
});

test("an exact updatedAt tie resolves identically regardless of argument order", () => {
  const mine = entry("a", { note: "mine", updatedAt: at(5) });
  const theirs = entry("a", { note: "theirs", updatedAt: at(5) });
  const ab = mergeActivities([mine], [theirs]);
  const ba = mergeActivities([theirs], [mine]);
  expect(ab).toStrictEqual(ba);
  expect(ab).toHaveLength(1);
  // The winner is one of the two real copies, never an invented blend.
  expect([mine, theirs]).toContainEqual(ab[0]);
});

test("output order is newest-first with exact ties broken by lexicographic id", () => {
  const local = [entry("banana", { updatedAt: at(5) }), entry("cherry", { updatedAt: at(9) })];
  const incoming = [entry("apple", { updatedAt: at(5) })];
  expect(mergeActivities(local, incoming).map((item) => item.id)).toEqual(["cherry", "apple", "banana"]);
  expect(mergeActivities(incoming, local).map((item) => item.id)).toEqual(["cherry", "apple", "banana"]);
});

test("a tombstone beats a live copy of equal or older updatedAt", () => {
  const tombstone = entry("a", { deleted: true, updatedAt: at(5) });
  expect(mergeActivities([entry("a", { updatedAt: at(5) })], [tombstone])).toStrictEqual([tombstone]);
  expect(mergeActivities([entry("a", { updatedAt: at(3) })], [tombstone])).toStrictEqual([tombstone]);
  expect(mergeActivities([tombstone], [entry("a", { updatedAt: at(5) })])).toStrictEqual([tombstone]);
});

test("an older live copy never resurrects a tombstone", () => {
  const tombstone = entry("a", { deleted: true, updatedAt: at(8) });
  const olderLive = entry("a", { updatedAt: at(2) });
  expect(mergeActivities([tombstone], [olderLive])).toStrictEqual([tombstone]);
  expect(mergeActivities([olderLive], [tombstone])).toStrictEqual([tombstone]);
});

test("a strictly newer live copy revives a tombstone (the delete-undo path)", () => {
  const tombstone = entry("a", { deleted: true, updatedAt: at(5) });
  const revived = entry("a", { updatedAt: at(6) });
  expect(mergeActivities([tombstone], [revived])).toStrictEqual([revived]);
  expect(mergeActivities([revived], [tombstone])).toStrictEqual([revived]);
});

test("legacy entries without updatedAt merge by startedAt", () => {
  const legacyNewer = legacyEntry("a", { startedAt: at(9), note: "legacy" });
  const stampedOlder = entry("a", { startedAt: at(0), updatedAt: at(4), note: "stamped" });
  expect(mergeActivities([legacyNewer], [stampedOlder])).toStrictEqual([legacyNewer]);

  const legacyOlder = legacyEntry("b", { startedAt: at(1), note: "legacy" });
  const stampedNewer = entry("b", { startedAt: at(1), updatedAt: at(7), note: "stamped" });
  expect(mergeActivities([legacyOlder], [stampedNewer])).toStrictEqual([stampedNewer]);

  const legacyEarly = legacyEntry("c", { startedAt: at(3) });
  const legacyLate = legacyEntry("c", { startedAt: at(6) });
  expect(mergeActivities([legacyEarly], [legacyLate])).toStrictEqual([legacyLate]);
});

test("empty-vs-full merges to the full side, both directions", () => {
  const full = [entry("a", { updatedAt: at(2) }), entry("b", { deleted: true, updatedAt: at(1) })];
  const fromEmpty = mergeActivities([], full);
  const intoEmpty = mergeActivities(full, []);
  expect(fromEmpty).toStrictEqual(intoEmpty);
  expect(fromEmpty.map((item) => item.id)).toEqual(["a", "b"]);
  expect(mergeActivities([], [])).toStrictEqual([]);
});

// Hand-rolled LCG (Numerical Recipes constants) — the fuzz round must replay
// identically on every run, so no Math.random.
function lcg(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

test("fuzz: merge(a, b) deep-equals merge(b, a) across 200 randomized entries", () => {
  const rand = lcg(20260809);
  const pick = <T>(values: readonly T[]): T => values[Math.floor(rand() * values.length)];
  const notes = ["", "nap", "bottle after bath", "fussy evening", "long feed"];
  // Only 12 distinct timestamps, so exact ties — same-id and cross-id — occur
  // constantly, with content that often differs between the two copies.
  const variant = (id: string): Activity => {
    const value: Activity = {
      id,
      type: pick(["bottle", "diaper", "sleep"] as const),
      startedAt: at(Math.floor(rand() * 12)),
      updatedAt: at(Math.floor(rand() * 12)),
    };
    const note = pick(notes);
    if (note) value.note = note;
    if (rand() < 0.2) value.deleted = true;
    if (rand() < 0.25) delete value.updatedAt; // legacy row
    return value;
  };

  const local: Activity[] = [];
  const incoming: Activity[] = [];
  for (let index = 0; index < 200; index += 1) {
    const id = `entry-${String(index).padStart(3, "0")}`;
    const membership = rand();
    if (membership < 0.6) {
      local.push(variant(id));
      incoming.push(variant(id));
    } else if (membership < 0.8) {
      local.push(variant(id));
    } else {
      incoming.push(variant(id));
    }
  }
  // Shuffle one side: list position must not influence the outcome.
  incoming.sort(() => (rand() < 0.5 ? -1 : 1));

  const ab = mergeActivities(local, incoming);
  const ba = mergeActivities(incoming, local);
  expect(ab).toStrictEqual(ba);

  const ids = new Set([...local, ...incoming].map((item) => item.id));
  expect(ab).toHaveLength(ids.size);
  expect(new Set(ab.map((item) => item.id)).size).toBe(ab.length);

  // Re-merging either input into the result changes nothing.
  expect(mergeActivities(ab, local)).toStrictEqual(ab);
  expect(mergeActivities(ab, incoming)).toStrictEqual(ab);
});

test("summarizeMerge counts new, updated and unchanged rows", () => {
  const local = [entry("kept", { updatedAt: at(1) }), entry("edited", { note: "old", updatedAt: at(1) })];
  const incoming = [entry("edited", { note: "new", updatedAt: at(2) }), entry("arrived", { updatedAt: at(1) })];
  const merged = mergeActivities(local, incoming);
  expect(summarizeMerge(local, merged)).toStrictEqual({ added: 1, updated: 1, unchanged: 1 });
});

test("re-importing your own backup reports every row unchanged", () => {
  const local = [entry("a", { updatedAt: at(1) }), entry("b", { deleted: true, updatedAt: at(2) }), legacyEntry("c")];
  // A backup round-trips through JSON: equal content, different objects.
  const roundTripped = JSON.parse(JSON.stringify(local)) as Activity[];
  const merged = mergeActivities(local, roundTripped);
  expect(summarizeMerge(local, merged)).toStrictEqual({ added: 0, updated: 0, unchanged: 3 });
});

const DEVICE_PREFS = { nightMode: false, reminders: { feedEnabled: false, feedIntervalMinutes: 180 } };

test("mergeStored adopts the incoming profile only when local is the empty default", () => {
  const emptyProfile: Profile = { name: "", birthDate: "", feedingMode: "mixed" };
  const localProfile: Profile = { name: "Mia", birthDate: "2026-05-01", feedingMode: "mixed" };
  const incomingProfile: Profile = { name: "Backup Mia", birthDate: "2026-05-02", feedingMode: "bottle" };
  const incoming = {
    activities: [entry("a")],
    profile: incomingProfile,
    nightMode: true,
    reminders: { feedEnabled: true, feedIntervalMinutes: 120 },
  };

  const fresh = mergeStored({ activities: [], profile: emptyProfile, ...DEVICE_PREFS }, incoming);
  expect(fresh.profile).toStrictEqual(incomingProfile);
  expect(fresh.activities.map((item) => item.id)).toEqual(["a"]);

  const settled = mergeStored({ activities: [], profile: localProfile, ...DEVICE_PREFS }, incoming);
  expect(settled.profile).toStrictEqual(localProfile);
});

test("mergeStored keeps local nightMode and reminders — device preferences, not baby data", () => {
  const profile: Profile = { name: "Mia", birthDate: "2026-05-01", feedingMode: "mixed" };
  const merged = mergeStored(
    { activities: [], profile, ...DEVICE_PREFS },
    { activities: [], profile, nightMode: true, reminders: { feedEnabled: true, feedIntervalMinutes: 120 } },
  );
  expect(merged.nightMode).toBe(false);
  expect(merged.reminders).toStrictEqual({ feedEnabled: false, feedIntervalMinutes: 180 });
});

// The sync-ingest path. Same conflict rule as the import merge, examined per
// incoming row rather than over the whole log, and an unchanged log comes
// back as the SAME array so the store can skip the write.
test("applyRemote: rows already held, unchanged, come back as the same array", () => {
  const local = [entry("a", { updatedAt: at(5) }), entry("b", { updatedAt: at(6) })];
  const result = applyRemote(local, [entry("a", { updatedAt: at(5) }), entry("b", { updatedAt: at(6) })]);
  expect(result.activities).toBe(local);
  expect(result).toMatchObject({ added: 0, updated: 0 });
  expect(applyRemote(local, []).activities).toBe(local);
});

test("applyRemote: a newer incoming copy replaces in place, an older one is ignored", () => {
  const local = [entry("a", { note: "old", updatedAt: at(5) }), entry("b", { note: "mine", updatedAt: at(9) })];
  const result = applyRemote(local, [
    entry("a", { note: "new", updatedAt: at(7) }),
    entry("b", { note: "stale", updatedAt: at(4) }),
  ]);
  expect(result.activities.map((item) => item.note)).toEqual(["new", "mine"]);
  expect(result).toMatchObject({ added: 0, updated: 1 });
  expect(local[0].note).toBe("old");
});

test("applyRemote: unknown rows are added in front, duplicates within a page fold by the same rule", () => {
  const local = [entry("a", { updatedAt: at(5) })];
  const result = applyRemote(local, [
    entry("c", { note: "first", updatedAt: at(1) }),
    entry("c", { note: "second", updatedAt: at(2) }),
    entry("b", { updatedAt: at(3) }),
  ]);
  expect(result.activities.map((item) => item.id)).toEqual(["c", "b", "a"]);
  expect(result.activities[0].note).toBe("second");
  expect(result).toMatchObject({ added: 2, updated: 0 });
});

test("applyRemote: a tombstone beats a live copy on a tie and the deletion sticks", () => {
  const local = [entry("a", { updatedAt: at(5) })];
  const result = applyRemote(local, [entry("a", { deleted: true, updatedAt: at(5) })]);
  expect(result.activities[0].deleted).toBe(true);
  expect(result.updated).toBe(1);
});

test("applyRemote agrees with mergeActivities on which copy of every id survives", () => {
  const local = [
    entry("a", { note: "l", updatedAt: at(5) }),
    entry("b", { note: "l", updatedAt: at(9) }),
    entry("c", { deleted: true, updatedAt: at(4) }),
    legacyEntry("d", { note: "legacy" }),
  ];
  const incoming = [
    entry("a", { note: "r", updatedAt: at(7) }),
    entry("b", { note: "r", updatedAt: at(2) }),
    entry("c", { note: "revived", updatedAt: at(4) }),
    entry("d", { note: "r", updatedAt: at(1) }),
    entry("e", { note: "r", updatedAt: at(3) }),
  ];
  const byId = (list: Activity[]) => [...list].sort((x, y) => (x.id < y.id ? -1 : 1));
  expect(byId(applyRemote(local, incoming).activities)).toStrictEqual(byId(mergeActivities(local, incoming)));
});
