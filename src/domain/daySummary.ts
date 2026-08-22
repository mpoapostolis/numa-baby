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
  /** A timer left open far longer than any real session was excluded from the
      minute figures — it is a forgotten stopwatch, not twenty hours of sleep. */
  hasStaleTimer: boolean;
  /** Changes logged as both wet and dirty: exactly wet + dirty - diapers. */
  both: number;

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

/** An open span older than this is a forgotten timer, not data. Above any
    plausible newborn sleep or nursing session, below a full day — so a genuine
    overnight is never dropped, but a timer nobody stopped three days ago stops
    handing 24 hours of "sleep" to every day in between. */
export const STALE_OPEN_SPAN_MINUTES = 18 * 60;

const EMPTY = {
  feeds: 0,
  bottles: 0,
  nursings: 0,
  ml: 0,
  nursingMinutes: 0,
  diapers: 0,
  wet: 0,
  dirty: 0,
  both: 0,
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
    hasStaleTimer: false,
    isEmpty: true,
  };

  const nowIso = new Date(now).toISOString();
  let firstFeedMs: number | undefined;
  let lastFeedMs: number | undefined;

  for (const activity of activities) {
    const isSpan = activity.type === "sleep" || activity.type === "nursing";
    const isOpen = isSpan && !activity.endedAt;
    const isStale =
      isOpen &&
      now - new Date(activity.startedAt).getTime() > STALE_OPEN_SPAN_MINUTES * 60_000;
    const startedToday = isSameDay(activity.startedAt, date);
    // Live spans belong to every day they touch; point events and forgotten
    // timers belong only to the day they started.
    const touchesDay = isSpan && !isStale
      ? minutesOnDay(activity, date, now) > 0 || startedToday
      : startedToday;
    if (!touchesDay) continue;

    if (isStale) summary.hasStaleTimer = true;
    else if (isOpen) summary.hasRunningTimer = true;

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
          // Compared as instants, never as strings: lexicographic order only
          // agrees with time while every value is the same UTC form, which a
          // restored backup carrying "+02:00" offsets breaks silently.
          const startedMs = new Date(activity.startedAt).getTime();
          if (firstFeedMs === undefined || startedMs < firstFeedMs) {
            firstFeedMs = startedMs;
            summary.firstFeedAt = activity.startedAt;
          }
          if (lastFeedMs === undefined || startedMs > lastFeedMs) {
            lastFeedMs = startedMs;
            summary.lastFeedAt = activity.startedAt;
          }
          // Minutes follow the count: a 23:50 nursing that ends at 00:10 is
          // one feed on the day it started, with all of its minutes there —
          // "0 feeds · 10m nursing" on the next day reads as a bug. A timer
          // nobody stopped is not twenty hours of nursing.
          if (activity.type === "nursing" && !isStale) {
            summary.nursingMinutes += minutesBetween(activity.startedAt, activity.endedAt ?? nowIso);
          }
        }
        break;
      }
      case "diaper": {
        summary.diapers += 1;
        if (activity.diaperKind === "both") summary.both += 1;
        // A kind-less diaper renders as "Wet diaper" in every row and title
        // (activityDisplay.ts) — the totals must tell the same story.
        if (activity.diaperKind !== "dirty") summary.wet += 1;
        if (activity.diaperKind === "dirty" || activity.diaperKind === "both") summary.dirty += 1;
        break;
      }
      case "sleep": {
        const minutes = isStale ? 0 : minutesOnDay(activity, date, now);
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
