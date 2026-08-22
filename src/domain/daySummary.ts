// One calendar day, summarized. Everything a parent (or their paediatrician)
// asks about a day — how many wet, how many dirty, how much milk, how long
// asleep — derived in a single pass so Today, Timeline and Insights all quote
// the same numbers.
//
// Two rules make the figures honest:
//   1. Spans are counted by the minutes that fall INSIDE the day (minutesOnDay),
//      so a sleep from 23:00 to 06:00 gives 60 minutes to one day and 360 to the
//      next — never 7 hours to both.
//   2. A running timer is clamped to `now`, so "sleep so far" is what has
//      actually happened, not a promise about the rest of the night.

import { isSameDay, minutesBetween, minutesOnDay } from "./time";
import { Activity } from "./types";

export type DaySummary = {
  /** Local midnight of the summarized day. */
  date: Date;
  /** True while this day is still being lived — figures are "so far". */
  isToday: boolean;
  /** A timer (nursing or sleep) was still running when this was computed. */
  hasRunningTimer: boolean;

  feeds: number;
  bottles: number;
  nursings: number;
  /** Millilitres from bottles logged with an amount. */
  ml: number;
  /** Minutes actually nursed on this day (open sessions clamped to now). */
  nursingMinutes: number;
  /** Local ISO times of the first and last feed, for "06:10 → 23:40". */
  firstFeedAt?: string;
  lastFeedAt?: string;

  /** Diaper changes logged. A "both" change is one change… */
  diapers: number;
  /** …but it counts in BOTH of these — the paediatrician asks separately. */
  wet: number;
  dirty: number;

  /** Sleep minutes falling inside this day, naps included. */
  sleepMinutes: number;
  /** Sleep sessions that touched this day. */
  naps: number;
  /** The longest single stretch's minutes inside this day. */
  longestSleepMinutes: number;

  growthEntries: number;
  healthEntries: number;
  /** Anything at all logged on this day. */
  isEmpty: boolean;
};

const EMPTY = {
  feeds: 0,
  bottles: 0,
  nursings: 0,
  ml: 0,
  nursingMinutes: 0,
  diapers: 0,
  wet: 0,
  dirty: 0,
  sleepMinutes: 0,
  naps: 0,
  longestSleepMinutes: 0,
  growthEntries: 0,
  healthEntries: 0,
};

/**
 * Summarize one calendar day.
 *
 * @param activities every activity (unsorted is fine — this filters and reduces)
 * @param day any Date inside the wanted day; only its calendar date is read
 * @param now the clock to clamp running timers against (the minute clock, so
 *            every figure on screen rolls over together)
 */
export function summarizeDay(activities: Activity[], day: Date, now: number): DaySummary {
  const date = new Date(day);
  date.setHours(0, 0, 0, 0);
  const isToday = isSameDay(new Date(now).toISOString(), date);

  const summary: DaySummary = {
    ...EMPTY,
    date,
    isToday,
    hasRunningTimer: false,
    isEmpty: true,
  };

  for (const activity of activities) {
    const isSpan = activity.type === "sleep" || activity.type === "nursing";
    // Spans belong to every day they touch; point events only to their own.
    const touchesDay = isSpan
      ? minutesOnDay(activity, date, now) > 0 || isSameDay(activity.startedAt, date)
      : isSameDay(activity.startedAt, date);
    if (!touchesDay) continue;

    const startedToday = isSameDay(activity.startedAt, date);
    if (isSpan && !activity.endedAt) summary.hasRunningTimer = true;

    switch (activity.type) {
      case "bottle":
      case "nursing": {
        // A feed is counted on the day it STARTED — a nursing session that runs
        // past midnight is still last night's feed, not two feeds.
        if (startedToday) {
          summary.feeds += 1;
          if (activity.type === "bottle") {
            summary.bottles += 1;
            summary.ml += activity.amount ?? 0;
          } else {
            summary.nursings += 1;
          }
          if (!summary.firstFeedAt || activity.startedAt < summary.firstFeedAt) {
            summary.firstFeedAt = activity.startedAt;
          }
          if (!summary.lastFeedAt || activity.startedAt > summary.lastFeedAt) {
            summary.lastFeedAt = activity.startedAt;
          }
          // Minutes follow the count: a 23:50 nursing that ends at 00:10 is
          // one feed on the day it started, with all of its minutes there —
          // "0 feeds · 10m nursing" on the next day reads as a bug.
          if (activity.type === "nursing") {
            summary.nursingMinutes += minutesBetween(
              activity.startedAt,
              activity.endedAt ?? new Date(now).toISOString(),
            );
          }
        }
        break;
      }
      case "diaper": {
        summary.diapers += 1;
        // A kind-less diaper renders as "Wet diaper" in every row and title
        // (activityDisplay.ts) — the totals must tell the same story.
        if (activity.diaperKind !== "dirty") summary.wet += 1;
        if (activity.diaperKind === "dirty" || activity.diaperKind === "both") summary.dirty += 1;
        break;
      }
      case "sleep": {
        const minutes = minutesOnDay(activity, date, now);
        if (minutes > 0) {
          summary.sleepMinutes += minutes;
          summary.naps += 1;
          summary.longestSleepMinutes = Math.max(summary.longestSleepMinutes, minutes);
        } else if (startedToday) {
          // A sleep logged with a zero-minute span (or just started) still
          // happened — count the nap, add no minutes.
          summary.naps += 1;
        }
        break;
      }
      case "growth":
        summary.growthEntries += 1;
        break;
      case "health":
        summary.healthEntries += 1;
        break;
    }
  }

  summary.isEmpty =
    summary.feeds === 0 &&
    summary.diapers === 0 &&
    summary.sleepMinutes === 0 &&
    summary.naps === 0 &&
    summary.growthEntries === 0 &&
    summary.healthEntries === 0;

  return summary;
}
