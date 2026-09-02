// Last night, in the morning.
//
// At 3am nobody types a message. At 7am the question is always the same, from
// the partner who slept, from a mother-in-law, from the parent themselves:
// "how was the night?" This answers it from the log, once, without anyone
// having to add up stretches on their fingers.
//
// The night is 19:00 to 07:00 — long enough to catch the evening bedtime, and
// it ends when the day starts. A sleep that straddles either end counts only
// for the minutes inside.

import { Activity } from "./types";

export type NightSummary = {
  /** Local midnight of the day the night ENDED on — the morning it belongs to. */
  morning: Date;
  from: Date;
  to: Date;
  sleepMinutes: number;
  /** The stretch every parent actually reports. */
  longestStretchMinutes: number;
  /** Sleeps that ended inside the night and were followed by another one. */
  wakeUps: number;
  feeds: number;
  diapers: number;
  /** ISO time of the first feed after the night began. */
  firstFeedAt: string | null;
  lastFeedAt: string | null;
};

const NIGHT_STARTS_AT = 19;
const NIGHT_ENDS_AT = 7;

/** The window for the night that ended on the morning of `now`. */
export function nightWindow(now: number): { from: Date; to: Date; morning: Date } {
  const at = new Date(now);
  const morning = new Date(at);
  morning.setHours(0, 0, 0, 0);
  // Before 07:00 the night that is ending is still the one that began
  // yesterday evening; the card is for the morning after it.
  const to = new Date(morning);
  to.setHours(NIGHT_ENDS_AT, 0, 0, 0);
  const from = new Date(morning);
  from.setDate(from.getDate() - 1);
  from.setHours(NIGHT_STARTS_AT, 0, 0, 0);
  return { from, to, morning };
}

const overlap = (start: number, end: number, from: number, to: number) =>
  Math.max(0, Math.min(end, to) - Math.max(start, from));

/**
 * What happened between 19:00 and 07:00. Returns null when the night holds
 * nothing at all — an empty card is worse than no card.
 */
export function summarizeNight(activities: Activity[], now: number): NightSummary | null {
  const { from, to, morning } = nightWindow(now);
  const start = from.getTime();
  const end = to.getTime();

  let sleepMinutes = 0;
  let longestStretchMinutes = 0;
  let feeds = 0;
  let diapers = 0;
  let firstFeedAt: string | null = null;
  let lastFeedAt: string | null = null;
  let stretches = 0;

  for (const activity of activities) {
    if (activity.deleted) continue;
    const began = new Date(activity.startedAt).getTime();
    if (!Number.isFinite(began)) continue;

    if (activity.type === "sleep") {
      // An open timer counts up to now, never past the end of the night.
      const finished = activity.endedAt ? new Date(activity.endedAt).getTime() : Math.min(now, end);
      if (!Number.isFinite(finished) || finished <= began) continue;
      const inside = overlap(began, finished, start, end);
      if (inside <= 0) continue;
      sleepMinutes += Math.round(inside / 60_000);
      longestStretchMinutes = Math.max(longestStretchMinutes, Math.round(inside / 60_000));
      stretches += 1;
      continue;
    }

    if (began < start || began >= end) continue;
    if (activity.type === "bottle" || activity.type === "nursing") {
      feeds += 1;
      if (firstFeedAt === null || began < new Date(firstFeedAt).getTime()) firstFeedAt = activity.startedAt;
      if (lastFeedAt === null || began > new Date(lastFeedAt).getTime()) lastFeedAt = activity.startedAt;
    }
    if (activity.type === "diaper") diapers += 1;
  }

  if (sleepMinutes === 0 && feeds === 0 && diapers === 0) return null;

  return {
    morning,
    from,
    to,
    sleepMinutes,
    longestStretchMinutes,
    // Three stretches means she surfaced twice; the last waking is the
    // morning, and nobody counts that one.
    wakeUps: Math.max(0, stretches - 1),
    feeds,
    diapers,
    firstFeedAt,
    lastFeedAt,
  };
}

/** True while the card is worth showing: the morning after, not all day. */
export function isMorning(now: number): boolean {
  const hour = new Date(now).getHours();
  return hour >= 5 && hour < 12;
}
