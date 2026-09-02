import { useMemo } from "react";
import { dayKey, summarizeDay, summarizeDays } from "../domain/daySummary";
import {
  DIAPER_BOUNDS,
  FEED_BOUNDS,
  SLEEP_BOUNDS,
  atClock,
  forecast,
  gapsBetween,
} from "../domain/forecast";
import { ageInMonths } from "../domain/time";
import { Activity, Profile } from "../domain/types";

// Every derived figure the screens read, split into two memos: one pass over
// the activities for everything that only changes when the data changes, and a
// second for the values that also roll over with the minute clock (today's
// totals, the weekly chart, the forecast windows). The expressions are ported
// verbatim so every number matches what the app showed before the extraction.

export type ActivityStats = ReturnType<typeof useActivityStats>;

export function useActivityStats(activities: Activity[], profile: Profile, minuteClock: number) {
  const base = useMemo(() => {
    const sortedActivities = [...activities].sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );

    // One newest-first pass collects every "last/active" value and the capped
    // source lists the pattern maths read from.
    let lastFeed: Activity | undefined;
    let lastBottle: Activity | undefined;
    let activeNursing: Activity | undefined;
    let activeBurp: Activity | undefined;
    let activeSleep: Activity | undefined;
    const completedSleeps: Activity[] = [];
    const activeTimers: Activity[] = [];
    const feedTimes: number[] = [];
    const diaperTimes: number[] = [];
    let lastDiaper: Activity | undefined;
    const growthByDate: Activity[] = [];
    for (const activity of sortedActivities) {
      const isFeed = activity.type === "bottle" || activity.type === "nursing";
      if (isFeed) {
        if (!lastFeed) lastFeed = activity;
        if (feedTimes.length < 30) feedTimes.push(new Date(activity.startedAt).getTime());
      }
      if (!lastBottle && activity.type === "bottle" && activity.amount && activity.milkType) {
        lastBottle = activity;
      }
      if (
        (activity.type === "nursing" || activity.type === "burp" || activity.type === "sleep") &&
        !activity.endedAt
      ) {
        // Every open session, not just nursing — a sleep timer left running by
        // an older version must stay visible and individually stoppable.
        activeTimers.push(activity);
        if (!activeNursing && activity.type === "nursing") activeNursing = activity;
        if (!activeBurp && activity.type === "burp") activeBurp = activity;
        if (!activeSleep && activity.type === "sleep") activeSleep = activity;
      }
      if (activity.type === "sleep" && activity.endedAt && completedSleeps.length < 24) {
        completedSleeps.push(activity);
      }
      if (activity.type === "diaper") {
        if (!lastDiaper) lastDiaper = activity;
        if (diaperTimes.length < 30) diaperTimes.push(new Date(activity.startedAt).getTime());
      }
      if (activity.type === "growth" && activity.weightGrams) growthByDate.push(activity);
    }

    const growthEntries = growthByDate.sort(
      (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
    );
    const latestGrowth = growthEntries[growthEntries.length - 1];
    const previousGrowth = growthEntries[growthEntries.length - 2];
    const weightChange =
      latestGrowth?.weightGrams && previousGrowth?.weightGrams
        ? latestGrowth.weightGrams - previousGrowth.weightGrams
        : 0;

    // Three forecasts, one piece of arithmetic — see domain/forecast.ts. The
    // windows are worked out here, where they only change when the data does;
    // whether one has gone by is decided against the minute clock below.
    const chronologicalSleeps = [...completedSleeps].sort(
      (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
    );
    // Sleep is the odd one out: the gap that matters runs from the END of one
    // sleep to the START of the next, which is how long the baby stayed awake.
    const wakeGaps = chronologicalSleeps.slice(1).map((sleep, index) => Math.round(
      (new Date(sleep.startedAt).getTime() - new Date(chronologicalSleeps[index].endedAt!).getTime()) / 60_000,
    ));
    const lastCompletedSleep = completedSleeps[0];

    const forecasts = {
      feed: forecast(
        "feed",
        gapsBetween(feedTimes),
        lastFeed ? new Date(lastFeed.startedAt).getTime() : null,
        0,
        FEED_BOUNDS,
      ),
      sleep: forecast(
        "sleep",
        wakeGaps,
        lastCompletedSleep?.endedAt ? new Date(lastCompletedSleep.endedAt).getTime() : null,
        0,
        SLEEP_BOUNDS,
      ),
      diaper: forecast(
        "diaper",
        gapsBetween(diaperTimes),
        lastDiaper ? new Date(lastDiaper.startedAt).getTime() : null,
        0,
        DIAPER_BOUNDS,
      ),
    };

    return {
      sortedActivities,
      lastFeed,
      lastBottle,
      activeNursing,
      activeBurp,
      activeSleep,
      lastDiaper,
      activeTimers,
      growthEntries,
      latestGrowth,
      previousGrowth,
      weightChange,
      forecasts,
      // Insights quotes this on its own ("feeds usually arrive about 3h
      // apart"), so it stays a named value rather than a reach into the
      // forecast object.
      typicalGap: forecasts.feed.typicalGap,
    };
  }, [activities]);

  const timeSensitive = useMemo(() => {
    const { sortedActivities } = base;
    // Derived from minuteClock, not a render-time `new Date()`, so every figure
    // rolls over together at midnight while the app stays open.
    // Re-judged every minute, so a window that has gone by stops presenting
    // history as a forecast the moment it does.
    const forecasts = {
      feed: atClock(base.forecasts.feed, minuteClock),
      sleep: atClock(base.forecasts.sleep, minuteClock),
      diaper: atClock(base.forecasts.diaper, minuteClock),
    };

    // The full breakdown every recap quotes — one shared source so Today,
    // Timeline and Insights can never disagree about a number.
    const today = summarizeDay(sortedActivities, new Date(minuteClock), minuteClock);
    // A fortnight of daily totals for the trend line — one pass, not fourteen.
    const recentDays = summarizeDays(sortedActivities, new Date(minuteClock), 14, minuteClock);

    // The week is the tail of that fortnight. This used to be seven filters
    // over the whole list plus a sleep walk per day, every minute — fourteen
    // full passes to redraw a chart that had not changed. Only the feed LISTS
    // are gathered here, in one pass; Insights counts bottles inside them.
    const weekDays = recentDays.slice(-7);
    const feedsByDay = new Map(weekDays.map((day) => [dayKey(day.date), [] as Activity[]]));
    for (const activity of sortedActivities) {
      if (activity.type !== "bottle" && activity.type !== "nursing") continue;
      feedsByDay.get(dayKey(new Date(activity.startedAt)))?.push(activity);
    }
    const weekly = weekDays.map((day) => ({
      date: day.date,
      feeds: feedsByDay.get(dayKey(day.date)) ?? [],
      ml: day.ml,
      diapers: day.diapers,
      sleep: day.sleepMinutes,
    }));
    const maxMl = Math.max(...weekly.map((day) => day.ml), 1);

    // Average over days actually tracked, not a fixed 7 — a two-day-old install
    // showing "Feeds / day: 0" beside "3 feeds today" contradicts itself.
    const oldestActivity = sortedActivities[sortedActivities.length - 1];
    const trackedDays = oldestActivity
      ? Math.max(1, Math.min(7, Math.floor((minuteClock - new Date(oldestActivity.startedAt).getTime()) / 86_400_000) + 1))
      : 0;
    const averageFeeds = trackedDays > 0
      ? Math.round((weekly.reduce((sum, day) => sum + day.feeds.length, 0) / trackedDays) * 10) / 10
      : null;

    return {
      today,
      recentDays,
      bottleMlToday: today.ml,
      forecasts,
      weekly,
      maxMl,
      trackedDays,
      averageFeeds,
    };
  }, [base, minuteClock]);

  const babyAgeMonths = ageInMonths(profile.birthDate, minuteClock);

  // One object identity per change, not per render: every screen takes this
  // whole and React.memo on them is only as good as this reference.
  return useMemo(() => ({ ...base, ...timeSensitive, babyAgeMonths }), [base, timeSensitive, babyAgeMonths]);
}
