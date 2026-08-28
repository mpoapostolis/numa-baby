// One calendar day, summarized. Everything a parent (or their paediatrician)
// asks about a day — how many wet, how many dirty, how much milk, how long
// asleep — derived in a single pass so Today, Timeline and Insights all quote
// the same numbers.
//
// Two rules make the figures honest:
//   1. An entry belongs to the day it STARTED, count and minutes together — a
//      23:50 nursing that ends at 00:10 is one feed last night, never two.
//   2. A running timer is clamped to `now`, so "nursed so far" is what has
//      actually happened, not a promise about the rest of the session.

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


  /** Sleep minutes falling inside this day — an overnight splits honestly. */
  sleepMinutes: number;
  /** Sleep stretches that started on this day. */
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
    // Sleep is the exception: a 22:00–06:00 stretch is two hours of THIS date
    // and six of the next, so it is counted by the minutes that fall inside
    // the day. Everything else belongs to the day it started, so a session
    // running past midnight is never counted twice.
    const isSleep = activity.type === "sleep";
    const startedToday = isSameDay(activity.startedAt, date);
    const sleepMinutesHere = isSleep ? minutesOnDay(activity, date, now) : 0;
    if (!startedToday && !(isSleep && sleepMinutesHere > 0)) continue;

    const isOpen =
      (activity.type === "nursing" || activity.type === "burp" || isSleep) && !activity.endedAt;
    const isStale =
      isOpen &&
      now - new Date(activity.startedAt).getTime() > STALE_OPEN_SPAN_MINUTES * 60_000;
    if (isStale) summary.hasStaleTimer = true;
    else if (isOpen) summary.hasRunningTimer = true;

    switch (activity.type) {
      case "bottle":
      case "nursing": {
        summary.feeds += 1;
        if (activity.type === "bottle") {
          summary.bottles += 1;
          summary.ml += activity.amount ?? 0;
        } else {
          summary.nursings += 1;
          // A timer nobody stopped is not twenty hours of nursing.
          if (!isStale) {
            summary.nursingMinutes += minutesBetween(activity.startedAt, activity.endedAt ?? nowIso);
          }
        }
        // Compared as instants, never as strings: lexicographic order only
        // agrees with time while every value is the same UTC form, which a
        // restored backup carrying "+02:00" offsets breaks silently.
        {
          const startedMs = new Date(activity.startedAt).getTime();
          if (firstFeedMs === undefined || startedMs < firstFeedMs) {
            firstFeedMs = startedMs;
            summary.firstFeedAt = activity.startedAt;
          }
          if (lastFeedMs === undefined || startedMs > lastFeedMs) {
            lastFeedMs = startedMs;
            summary.lastFeedAt = activity.startedAt;
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
        // A forgotten timer is not twenty hours of sleep, so a stale one keeps
        // its entry and contributes no minutes.
        if (startedToday) summary.naps += 1;
        if (!isStale) {
          summary.sleepMinutes += sleepMinutesHere;
          summary.longestSleepMinutes = Math.max(summary.longestSleepMinutes, sleepMinutesHere);
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
    summary.naps === 0 &&
    summary.sleepMinutes === 0 &&
    summary.growthEntries === 0 &&
    summary.healthEntries === 0;

  return summary;
}

/**
 * The last `count` calendar days ending on `endDay`, oldest first.
 *
 * One bucketing pass over the activities, then one summarize per day over its
 * own bucket — O(activities), not O(days x activities), so a fortnight of
 * trend lines re-derived on every minute tick stays free.
 */
export function summarizeDays(
  activities: Activity[],
  endDay: Date,
  count: number,
  now: number,
): DaySummary[] {
  const days: Date[] = [];
  const buckets = new Map<string, Activity[]>();
  for (let index = count - 1; index >= 0; index--) {
    const date = new Date(endDay);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - index);
    days.push(date);
    buckets.set(dayKey(date), []);
  }

  for (const activity of activities) {
    const bucket = buckets.get(dayKey(new Date(activity.startedAt)));
    if (bucket) bucket.push(activity);
  }

  return days.map((date) => summarizeDay(buckets.get(dayKey(date)) ?? [], date, now));
}

// Local calendar key — never toISOString(), which would bucket by UTC and
// shift every evening entry into the next day east of Greenwich.
function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
