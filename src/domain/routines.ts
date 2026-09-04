// The short list of things that have to happen every day.
//
// Vitamin D, a medicine, drops — the things whose whole difficulty is not
// doing them but REMEMBERING whether they were done. With two parents that
// question has a worse shape still: "did you give it, or should I?", asked at
// the exact moment neither of you is sure. Guessing wrong means a dose twice
// or a dose missed.
//
// So a tick is an ordinary activity, not a private flag. That one decision is
// what makes it answer the question: it syncs to the other parent's phone
// like everything else, it can be undone, it sits in the timeline with the
// time on it, and the merge rules that already exist decide who was right
// when two phones disagree. Nothing new had to be trusted.
//
// The list itself lives on the profile, because it is a fact about how this
// family's day is run rather than a setting of one device — so it reaches the
// other phone by the path the baby's name already travels.

import type { Activity } from "./types";
import { dayKey } from "./daySummary";

export type Routine = { id: string; label: string };

/** Six is already more than anybody keeps up with, and a list nobody
    finishes is a card that never goes away. */
export const MAX_ROUTINES = 6;
export const LABEL_MAX = 32;

/** What a routine tick looks like in the log. */
export const ROUTINE_TYPE = "routine";

/** The ids ticked off on the day `now` falls in, by local calendar day —
    "today" for a parent at 1am is still yesterday's list until they sleep,
    but a calendar day is the only definition anyone can predict. */
export function doneToday(activities: Activity[], now: number): Set<string> {
  const today = dayKey(new Date(now));
  const done = new Set<string>();
  for (const activity of activities) {
    if (activity.type !== ROUTINE_TYPE || !activity.routineId) continue;
    if (dayKey(new Date(activity.startedAt)) === today) done.add(activity.routineId);
  }
  return done;
}

/** The ones still waiting, in the order the family wrote them. */
export function pendingRoutines(routines: Routine[], activities: Activity[], now: number): Routine[] {
  if (!routines.length) return [];
  const done = doneToday(activities, now);
  return routines.filter((routine) => !done.has(routine.id));
}

/** A label somebody typed, made safe to keep. Empty means "not a routine". */
export function readLabel(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, LABEL_MAX) : "";
}

/**
 * The id for a label — derived, not minted.
 *
 * A random id meant that removing "Vitamin D" and adding it straight back
 * produced a different id, so a dose already given that morning showed as
 * still waiting. That is precisely the double-dose question this feature
 * exists to answer, so the id has to survive the round trip.
 *
 * The lowercased label is exactly the key the duplicate rule already uses,
 * so it is unique across a list by construction, and it works for a label in
 * any alphabet — slugifying to ASCII would collapse a Greek list to nothing.
 */
export function routineId(label: string): string {
  return label.trim().toLowerCase();
}

/** Add one, refusing a blank, a duplicate, and a seventh. */
export function addRoutine(routines: Routine[], label: unknown): Routine[] | null {
  const clean = readLabel(label);
  if (!clean) return null;
  if (routines.length >= MAX_ROUTINES) return null;
  const id = routineId(clean);
  // Case-insensitive, because two rows reading "Vitamin D" and "vitamin d"
  // are one thing the family has to tick twice.
  if (routines.some((routine) => routineId(routine.label) === id || routine.id === id)) return null;
  return [...routines, { id, label: clean }];
}

export function removeRoutine(routines: Routine[], id: string): Routine[] {
  return routines.filter((routine) => routine.id !== id);
}

/** Storage and sync both hand this whatever they were given. */
export function sanitizeRoutines(value: unknown): Routine[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const clean: Routine[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const { id, label } = entry as { id?: unknown; label?: unknown };
    const text = readLabel(label);
    if (typeof id !== "string" || !id || id.length > 64 || !text) continue;
    // By id AND by label. Ids are derived from labels now, but a partner on
    // the build where they were random can still send two rows meaning the
    // same thing — which would render two pills that tick each other off.
    if (seen.has(id) || seen.has(routineId(text))) continue;
    seen.add(id);
    seen.add(routineId(text));
    clean.push({ id, label: text });
    if (clean.length >= MAX_ROUTINES) break;
  }
  return clean;
}
