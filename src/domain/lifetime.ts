// Everything since day one.
//
// Its own module because the app shell needs these totals for the
// month-birthday card and nothing else: importing them from shareCards.ts
// pulled all six card builders and their formatting into the first
// download, for a number that fits in four lines of arithmetic.

import { Activity } from "./types";

export type LifetimeTotals = { feeds: number; nappies: number; sleepMinutes: number; ml: number };

/**
 * Everything since day one. Tombstones are skipped; a sleep still running,
 * or one left open for days, is not counted — a forgotten stopwatch is not
 * a week of sleep.
 */
export function lifetimeTotals(activities: Activity[]): LifetimeTotals {
  const totals: LifetimeTotals = { feeds: 0, nappies: 0, sleepMinutes: 0, ml: 0 };
  for (const activity of activities) {
    if (activity.deleted) continue;
    switch (activity.type) {
      case "bottle":
        totals.feeds += 1;
        totals.ml += activity.amount ?? 0;
        break;
      case "nursing":
        totals.feeds += 1;
        break;
      case "diaper":
        totals.nappies += 1;
        break;
      case "sleep": {
        if (!activity.endedAt) break;
        const minutes = (new Date(activity.endedAt).getTime() - new Date(activity.startedAt).getTime()) / 60_000;
        if (minutes > 0 && minutes <= 24 * 60) totals.sleepMinutes += Math.round(minutes);
        break;
      }
      default:
        break;
    }
  }
  return totals;
}
