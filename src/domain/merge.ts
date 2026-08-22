import { Activity, Profile, ReminderSettings } from "./types";
import { activityUpdatedAt } from "./validate";

// Merge-on-import. A backup is a sync artifact from another device (or an
// older self), so importing must be a union, never a replace: every entry that
// exists on either side survives, and for an id present on both the copy with
// the newer last-write wins. The whole module is pure and deterministic —
// mergeActivities(a, b) deep-equals mergeActivities(b, a) — so the result of
// a two-device swap does not depend on who imports first.

function updatedAtMs(activity: Activity): number {
  return new Date(activityUpdatedAt(activity)).getTime();
}

// Key-order-independent serialization, used only to settle exact ties
// deterministically and to compare content for the import summary. Two
// activities with the same fields are equal no matter which JSON file they
// came from or how its keys were ordered.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

// Same-id conflict rule: the newer last-write (activityUpdatedAt, so legacy
// rows compare by startedAt) wins. On an exact tie a tombstone beats a live
// copy — a deletion that raced an edit to the same instant stays deleted, and
// a tombstone can only be revived by a STRICTLY newer live write (which is
// exactly what the delete-undo path produces). A tie between two copies of the
// same age and liveness is settled by canonical content, so the pick is
// independent of argument order; in the common case (re-importing your own
// backup) the copies are identical and the choice is invisible.
function resolveConflict(a: Activity, b: Activity): Activity {
  const aMs = updatedAtMs(a);
  const bMs = updatedAtMs(b);
  if (aMs > bMs) return a;
  if (bMs > aMs) return b;
  if (a.deleted && !b.deleted) return a;
  if (b.deleted && !a.deleted) return b;
  return canonical(a) <= canonical(b) ? a : b;
}

// Deterministic output order is part of the commutativity contract: newest
// last-write first, exact ties broken by lexicographic id. No UI surface reads
// stored order (screens re-sort by startedAt), but merge(a, b) must deep-equal
// merge(b, a) as arrays, so the order cannot depend on which list came first.
function compareMergedOrder(a: Activity, b: Activity): number {
  const diff = updatedAtMs(b) - updatedAtMs(a);
  if (diff) return diff;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// Union by id. Duplicate ids WITHIN one list are folded by the same conflict
// rule, so a malformed backup cannot smuggle in two rows with one id.
export function mergeActivities(local: Activity[], incoming: Activity[]): Activity[] {
  const byId = new Map<string, Activity>();
  for (const activity of [...local, ...incoming]) {
    const current = byId.get(activity.id);
    byId.set(activity.id, current ? resolveConflict(current, activity) : activity);
  }
  return [...byId.values()].sort(compareMergedOrder);
}

export type MergeSummary = { added: number; updated: number; unchanged: number };

// The import toast's numbers, from the local timeline's point of view, counted
// over stored rows (tombstones included — a deletion arriving from another
// device is an update to the row it kills). "updated" is content-based, not
// winner-based: re-importing your own backup reports every row unchanged even
// though no local copy "won" anything.
export function summarizeMerge(local: Activity[], merged: Activity[]): MergeSummary {
  const localById = new Map(local.map((activity) => [activity.id, activity]));
  const summary: MergeSummary = { added: 0, updated: 0, unchanged: 0 };
  for (const activity of merged) {
    const mine = localById.get(activity.id);
    if (!mine) summary.added += 1;
    else if (canonical(mine) === canonical(activity)) summary.unchanged += 1;
    else summary.updated += 1;
  }
  return summary;
}

export type MergeableStored = {
  activities: Activity[];
  profile: Profile;
  nightMode: boolean;
  reminders: ReminderSettings;
};

function isEmptyDefaultProfile(profile: Profile): boolean {
  return profile.name === "" && profile.birthDate === "";
}

// Profile carries no per-field timestamps, so a field-wise newer-wins merge is
// impossible — there is no way to tell whose `name` or `birthDate` is fresher,
// and guessing could overwrite a correction the parent made minutes ago on
// this device. The only safe rule: adopt the incoming profile when the local
// one is still the untouched empty default (fresh device or recovery restore),
// otherwise keep local — it is visible and editable right here if wrong.
// nightMode and reminders are device preferences, not baby data (notification
// permission is granted per device), so local always wins for those.
export function mergeStored(local: MergeableStored, incoming: MergeableStored): MergeableStored {
  return {
    activities: mergeActivities(local.activities, incoming.activities),
    profile: isEmptyDefaultProfile(local.profile) ? incoming.profile : local.profile,
    nightMode: local.nightMode,
    reminders: local.reminders,
  };
}
