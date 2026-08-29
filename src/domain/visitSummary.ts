// The summary a parent hands to the paediatrician.
//
// Every number here is a plain reduction of entries the family logged — no
// estimate, no model, no interpolation. A wrong millilitre figure on a sheet
// a doctor reads is the worst failure this app could have, so anything the
// log cannot answer is reported as unanswered rather than filled in.
//
// The one thing this does that a naive average would not: it counts days with
// NO entries and reports them, because "3 wet nappies a day" means something
// completely different if four of the fourteen days were never logged.

import { DaySummary, summarizeDays, hasRoutineCare } from "./daySummary";
import { median } from "./time";
import { Activity } from "./types";

export type VisitSummary = {
  days: DaySummary[];
  /** Days in the window carrying at least one entry. */
  loggedDays: number;
  /** Days with nothing at all — stated, never silently averaged away. */
  blankDays: number;

  feedsPerDay: number | null;
  mlPerDay: number | null;
  nursingMinutesPerDay: number | null;
  wetPerDay: number | null;
  dirtyPerDay: number | null;

  /** Totals over the whole window, for the doctor who prefers absolutes. */
  totalFeeds: number;
  totalMl: number;
  totalWet: number;
  totalDirty: number;

  latestWeightGrams?: number;
  latestWeightAt?: string;
  previousWeightGrams?: number;
  previousWeightAt?: string;
  /** Grams per week between the last two weights, when both exist and are apart. */
  gramsPerWeek: number | null;
};

/** Median over the days that carry routine care — blanks would drag it to
    zero, and so would a day holding only a growth check or a solids entry. */
function perLoggedDay(days: DaySummary[], pick: (day: DaySummary) => number): number | null {
  const values = days.filter(hasRoutineCare).map(pick);
  return values.length ? median(values) : null;
}

export function buildVisitSummary(
  activities: Activity[],
  now: number,
  windowDays = 14,
): VisitSummary {
  const days = summarizeDays(activities, new Date(now), windowDays, now);
  // Routine care, not any entry at all: a day holding only a growth check or
  // a solids entry has no feed/nappy story to tell, and printing its zeros
  // would read as "logged, and nothing happened".
  const logged = days.filter(hasRoutineCare);

  const weights = activities
    .filter((activity) => activity.type === "growth" && activity.weightGrams)
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
  const last = weights.at(-1);
  const previous = weights.at(-2);
  const spanDays = last && previous
    ? (new Date(last.startedAt).getTime() - new Date(previous.startedAt).getTime()) / 86_400_000
    : 0;

  return {
    days,
    loggedDays: logged.length,
    blankDays: days.length - logged.length,

    feedsPerDay: perLoggedDay(days, (day) => day.feeds),
    mlPerDay: perLoggedDay(days, (day) => day.ml),
    nursingMinutesPerDay: perLoggedDay(days, (day) => day.nursingMinutes),
    wetPerDay: perLoggedDay(days, (day) => day.wet),
    dirtyPerDay: perLoggedDay(days, (day) => day.dirty),

    totalFeeds: days.reduce((sum, day) => sum + day.feeds, 0),
    totalMl: days.reduce((sum, day) => sum + day.ml, 0),
    totalWet: days.reduce((sum, day) => sum + day.wet, 0),
    totalDirty: days.reduce((sum, day) => sum + day.dirty, 0),

    latestWeightGrams: last?.weightGrams,
    latestWeightAt: last?.startedAt,
    previousWeightGrams: previous?.weightGrams,
    previousWeightAt: previous?.startedAt,
    gramsPerWeek:
      last?.weightGrams && previous?.weightGrams && spanDays >= 1
        ? Math.round(((last.weightGrams - previous.weightGrams) / spanDays) * 7)
        : null,
  };
}
