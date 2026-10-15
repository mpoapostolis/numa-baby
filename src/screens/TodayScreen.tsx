import { Suspense, lazy, memo, useState } from "react";
import { Camera, ChevronRight, Cloud, CloudOff, Gift, History, Images, Milk, Pill, ShieldCheck, Smile, Square, Syringe, Thermometer, Utensils, Waves, Weight } from "lucide-react";

import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { ItemGroup, ItemSeparator } from "../components/ui/item";
import { ActivityGlyph } from "../components/ActivityGlyph";
import { ActivityRow } from "../components/ActivityRow";
import { DayBand } from "../components/DayBand";
import { ComingUp, ComingUpEntry } from "../components/ComingUp";
import { LastNight } from "../components/LastNight";
import { NormalCheck } from "../components/NormalCheck";
import { DayRecap } from "../components/DayRecap";
import { TrendChart } from "../components/TrendChart";
// The noise generator is only needed once someone asks for it, so it stays
// out of the bundle every parent downloads.
import { EmptyState } from "../components/EmptyState";
import { LittleBottle } from "../components/illustrations";
import { BabyCompanion, CompanionMood } from "../components/BabyCompanion";
import { mlBucket, track } from "../domain/analytics";
import { detailReadsClock } from "../domain/activityDisplay";
import { hasRoutineCare, summarizeDay } from "../domain/daySummary";
import { makeId } from "../domain/id";
import {
  ageInMonths,
  ageInDays,
  formatBabyAge,
  formatTime,
  formatTimelineDay,
  greeting,
  humanDuration,
  isSameDay,
  liveDuration,
  minutesBetween,
} from "../domain/time";
import { dueLabel, dueSoon, vaccineLabel } from "../domain/vaccines";
import { MONTHS_KEPT } from "../domain/keepsakes";
import { tummyGoalMinutes } from "../domain/tummyGoal";
import { usePhoto } from "../hooks/usePhoto";
import { Activity, DiaperKind, Profile, Sheet } from "../domain/types";
import { UnitSystem, formatVolume, useUnits } from "../domain/units";
import { Milestone } from "../domain/milestones";
import { LifetimeTotals } from "../domain/lifetime";
import { shareLink } from "../domain/shareApp";
import { isMorning, summarizeNight } from "../domain/nightSummary";
import { typicalVerdict } from "../domain/typical";
import { ROUTINE_TYPE, pendingRoutines, type Routine } from "../domain/routines";
import { shareCardOnTap } from "../lib/shareOnTap";

/** "Jun 28" — the short day the secondary rows speak in. */
function shortDay(value: Date) {
  return value.toLocaleDateString("en", { month: "short", day: "numeric" });
}

// A party is downloaded only on a day there is one.
// Same rule for the share fallback dialog — phones use the native sheet and
// never load this chunk at all.
const ShareNumalogDialog = lazy(() => import("../components/ShareNumalog"));
const MilestoneParty = lazy(() =>
  import("../components/MilestoneParty").then((m) => ({ default: m.MilestoneParty })),
);
// The fact card carries the whole eleven-kilobyte fact table with it; it
// sits below the log tiles, so a frame's delay costs a tired thumb nothing.
const FactOfTheDay = lazy(() => import("../components/FactOfTheDay"));
// Lazy on purpose even though it sits high on the screen: most families keep
// no routine list at all, and they should not download a card they will
// never be shown. The rules that decide whether it appears are cheap and
// stay here; only the card itself waits.
const DailyRoutines = lazy(() =>
  import("../components/DailyRoutines").then((m) => ({ default: m.DailyRoutines })),
);
import { ActivityStats } from "../hooks/useActivityStats";
import { useSecondClock } from "../hooks/useMinuteClock";

const statusDateFormat = new Intl.DateTimeFormat("en", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

// The Hearth meta line stays short: the last feed at a glance, not the full
// timeline entry — ranges and edit affordances live in Recent and Timeline.
function lastFeedSummary(feed: Activity, units: UnitSystem) {
  if (feed.type === "bottle") {
    return `Bottle · ${formatVolume(feed.amount ?? 0, units)}`;
  }
  // A mum picks the next side from this line, so it never guesses one: a
  // "both" session says so, and a nursing saved without a side names none.
  const side = feed.side === "both" ? "both sides" : feed.side === "left" ? "left" : feed.side === "right" ? "right" : null;
  return [
    "Nursing",
    side,
    feed.endedAt ? humanDuration(minutesBetween(feed.startedAt, feed.endedAt)) : null,
  ].filter(Boolean).join(" · ");
}

// Display figure with unit demotion: digits speak, units recede.
function DurationFigure({ minutes }: { minutes: number }) {
  if (minutes <= 0) return <span className="is-zero">—</span>;
  if (minutes < 60) {
    return (
      <>
        {minutes}
        <span className="unit">m</span>
      </>
    );
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return (
    <>
      {hours}
      <span className="unit">h</span>
      {mins > 0 && (
        <>
          {" "}
          {mins}
          <span className="unit">m</span>
        </>
      )}
    </>
  );
}

/** The baby's photo, small, on the drawn face — once it is on this phone. */
function FacePhoto({ photo }: { photo: string }) {
  const url = usePhoto(photo);
  return url ? <span className="welcome-face-photo"><img src={url} alt="" decoding="async" /></span> : null;
}

/** "4‑month", "1‑year": a month-birthday as a word before a noun. */
function monthWord(month: number) {
  return month % 12 === 0 ? `${month / 12}‑year` : `${month}‑month`;
}

/**
 * A vaccine that is late or due this week, named at the top of Today — where
 * a parent looks first — until it is marked given. Most days: nothing.
 */
function VaccinePill({ vaccine, now, onOpen }: { vaccine: Activity | undefined; now: number; onOpen: () => void }) {
  if (!vaccine?.due) return null;
  const due = dueLabel(vaccine.due, now);
  const when = due.overdue ? `${-due.days} day${due.days === -1 ? "" : "s"} late` : due.inline;
  return (
    <button type="button" className={due.overdue ? "top-pill is-vaccine is-late" : "top-pill is-vaccine"} onClick={onOpen}>
      <Syringe size={14} aria-hidden="true" />
      <span>{vaccine.vaccine ?? "Vaccine"} vaccine · {when}</span>
      <ChevronRight size={12} aria-hidden="true" />
    </button>
  );
}

/**
 * The way into the monthly photos, always there beside the baby's age: it
 * asks for this month's photo until there is one ("Add the 4‑month photo"),
 * and then wears it.
 */
function MonthsPill({ month, photo, onOpenMonth, onOpenAlbum }: {
  month: number;
  photo: string | undefined;
  onOpenMonth: (month: number) => void;
  onOpenAlbum: () => void;
}) {
  const url = usePhoto(photo);
  const asks = month >= 1 && month <= MONTHS_KEPT && !photo;
  return (
    <button type="button" className="top-pill is-month" onClick={() => (asks ? onOpenMonth(month) : onOpenAlbum())}>
      {url ? <img src={url} alt="" /> : <Camera size={14} aria-hidden="true" />}
      <span>{asks ? `Add the ${monthWord(month)} photo` : "Monthly photos"}</span>
    </button>
  );
}

function GapFigure({ startedAt, now }: { startedAt?: string; now: number }) {
  if (!startedAt) return <span className="is-zero">—</span>;
  const minutes = minutesBetween(startedAt, new Date(now).toISOString());
  if (minutes < 1) return <>just now</>;
  const days = Math.floor(minutes / 1_440);
  if (days > 0) {
    const hours = Math.floor((minutes % 1_440) / 60);
    return (
      <>
        {days}
        <span className="unit">d</span>
        {hours > 0 && (
          <>
            {" "}
            {hours}
            <span className="unit">h</span>
          </>
        )}
      </>
    );
  }
  return <DurationFigure minutes={minutes} />;
}

// A running burp is a stopwatch you watch: the seconds tick in place, so a
// parent holding the baby upright after a feed can see exactly how long it
// has been without doing arithmetic on a start time.
function LiveClock({ startedAt }: { startedAt: string }) {
  const now = useSecondClock();
  return <span className="timer-clock t-numeral">{liveDuration(startedAt, now)}</span>;
}

/**
 * Tummy time while it runs, in the row that started it: the seconds where
 * the subtitle was (the start time is the way to correct it), and Done.
 */
function TummyRunning({ activity, onStop, onEdit }: { activity: Activity; onStop: () => void; onEdit: (activity: Activity) => void }) {
  return (
    <div className="log-row log-row-secondary tummy-running">
      <span className="action-icon" aria-hidden="true"><Smile /></span>
      <button type="button" className="log-copy tummy-running-copy" onClick={() => onEdit(activity)}>
        <strong>Tummy time</strong>
        <small><LiveClock startedAt={activity.startedAt} /> · <span className="tile-started-edit">Edit</span></small>
      </button>
      <Button className="tummy-done" onClick={onStop} aria-label="Done — stop tummy time timer">
        <Square size={14} fill="currentColor" aria-hidden="true" /> Done
      </Button>
    </div>
  );
}

/**
 * The tummy time row, idle: what today adds up to against the day's goal for
 * this age — none yet, how much is left, or that it is done. With no goal
 * (no birth date, or past about 7 months) just the total, or how to start.
 */
function tummyLine(ms: number, goal: number | null): string {
  // Judged on the seconds, shown in minutes: a 20-second go is not "none",
  // and 29m 30s of a 30-minute goal is not done.
  const minutes = Math.round(ms / 60_000);
  const done = ms > 0 && minutes === 0 ? "<1m" : humanDuration(minutes);
  if (goal === null) return ms > 0 ? `${done} today · start the timer` : "Start the timer — awake, and watched";
  if (ms === 0) return `None yet today · aim for ${humanDuration(goal)}, awake and watched`;
  const left = goal * 60_000 - ms;
  if (left > 0) {
    // Short of the goal, the minutes so far round down and those to go round
    // up, so the two always add up: never "30m of 30m · 1m to go".
    const sofar = Math.floor(ms / 60_000);
    return `${sofar === 0 ? "<1m" : humanDuration(sofar)} of ${humanDuration(goal)} today · ${humanDuration(Math.ceil(left / 60_000))} to go`;
  }
  return `${done} today · today’s ${humanDuration(goal)} done`;
}

/** "Both" is a real answer for a nursing session, not a missing one. */
function sideLabel(side: Activity["side"]) {
  return side === "both" ? "Both" : side === "left" ? "Left" : side === "right" ? "Right" : null;
}

/** "Nursing · Left", or just "Nursing" when no side was saved. */
function nursingTitle(side: Activity["side"]) {
  const label = sideLabel(side);
  return label ? `Nursing · ${label}` : "Nursing";
}

// A running timer stays in the tile that started it.
//
// It used to vanish from the grid and reappear as a row somewhere else, which
// meant the tiles reflowed under a thumb mid-tap and the thing just started
// was the one thing not on screen. One place per activity, always the same
// place: tap Sleep and the Sleep tile becomes the clock.
function TimerTile({ activity, onStop, onEdit }: { activity: Activity; onStop: () => void; onEdit: (activity: Activity) => void }) {
  const isSleep = activity.type === "sleep";
  const isBurp = activity.type === "burp";
  const title = isSleep
    ? "Sleeping"
    : isBurp
      ? "Burping"
      : nursingTitle(activity.side);
  const stopLabel = isSleep ? "Wake up" : isBurp ? "Done" : "Stop";
  return (
    <div className={`quick-tile tile-${activity.type} is-running`}>
      <div className="tile-head">
        <span className={`activity-glyph glyph-${activity.type}`} aria-hidden="true">
          <ActivityGlyph type={activity.type} />
        </span>
        <span className="tile-title">{title}</span>
      </div>
      {/* Seconds, because a stopwatch that only moves once a minute looks
          stopped — and looking stopped is how a parent taps it twice. */}
      <p className="tile-elapsed"><LiveClock startedAt={activity.startedAt} /></p>
      {/* Asked for from the feedback box: the tap that started this may have
          come twenty minutes late, and the one that stops it may never come.
          The start time is the way into the edit sheet, where Started moves
          back and Ended takes the wake-up that was missed. */}
      <button type="button" className="tile-started" onClick={() => onEdit(activity)}>
        Started {formatTime(activity.startedAt)} <span className="tile-started-edit">· Edit</span>
      </button>
      {/* The accessible name starts with the visible label, so "tap Wake up"
          works for voice control (WCAG label-in-name). */}
      <Button className="tile-stop" onClick={onStop} aria-label={`${stopLabel} — stop ${activity.type} timer`}>
        <Square size={14} fill="currentColor" aria-hidden="true" /> {stopLabel}
      </Button>
    </div>
  );
}

// Kept for a timer whose tile is not on screen — a nursing session still
// running for a family that has since switched to bottles only. Rare, and it
// must never become invisible.
function TimerRow({
  activity,
  now,
  onStop,
  onEdit,
}: {
  activity: Activity;
  now: number;
  onStop: () => void;
  onEdit: (activity: Activity) => void;
}) {
  const isSleep = activity.type === "sleep";
  const isBurp = activity.type === "burp";
  const title = isSleep
    ? "Sleeping now"
    : isBurp
      ? "Burping"
      : nursingTitle(activity.side);
  const stopLabel = isSleep ? "Wake up" : isBurp ? "Done" : "Stop";
  return (
    <div className="log-row timer-row">
      <span className={`activity-glyph glyph-${activity.type}`}>
        <ActivityGlyph type={activity.type} />
      </span>
      <div className="log-copy">
        <strong>{title}</strong>
        <small>
          Started {formatTime(activity.startedAt)}
          {!isBurp && ` · ${humanDuration(minutesBetween(activity.startedAt, new Date(now).toISOString()))}`}
        </small>
      </div>
      {isBurp && <LiveClock startedAt={activity.startedAt} />}
      <div className="log-actions">
        <Button variant="ghost" onClick={() => onEdit(activity)} aria-label={`Edit — change when this ${activity.type} started or ended`}>
          Edit
        </Button>
        <Button onClick={onStop} aria-label={`${stopLabel} — stop ${activity.type} timer`}>
          <Square size={14} fill="currentColor" aria-hidden="true" /> {stopLabel}
        </Button>
      </div>
    </div>
  );
}

type TodayScreenProps = {
  profile: Profile;
  nightMode: boolean;
  minuteClock: number;
  stats: ActivityStats;
  /** Today's milestone, decided once per day by App and frozen for the visit. */
  celebration: Milestone | null;
  /** Since-day-one totals for the party's picture; null on any other day. */
  milestoneTotals: LifetimeTotals | null;
  /** The party's own 🎉: dismissed for the day, on every return to Today. */
  onDismissCelebration: () => void;
  onAdd: (activity: Activity, message: string) => boolean;
  onStopTimer: (id: string) => void;
  onOpenSheet: (sheet: Exclude<Sheet, null>) => void;
  onManualNursing: () => void;
  onEdit: (activity: Activity) => void;
  onSeeTimeline: () => void;
  /** The sound player belongs to App, not to this screen — see App.tsx. */
  onOpenSoothe: () => void;
  /** The vaccination schedule, soonest first. */
  plannedVaccines: Activity[];
  /** The latest vaccine given, when nothing is planned. */
  lastVaccine?: Activity;
  /** The month the family is living in (0 before the first month-birthday)
      and its photo, if it has one; null without a date of birth. */
  monthNow: { month: number; photo?: string } | null;
  /** Open one month's page — from the hero, and the month-birthday card. */
  onOpenMonth: (month: number) => void;
  /** Where the log lives right now, in one word. */
  cloudState: "none" | "synced" | "syncing" | "offline" | "revoked";
  /** Tap on the note — the doors when unprotected, the details when synced. */
  onOpenProtection: () => void;
};

function TodayScreen({
  profile,
  nightMode,
  minuteClock,
  stats,
  celebration,
  milestoneTotals,
  onDismissCelebration,
  onAdd,
  onStopTimer,
  onOpenSheet,
  onManualNursing,
  onEdit,
  onSeeTimeline,
  onOpenSoothe,
  plannedVaccines,
  lastVaccine,
  monthNow,
  onOpenMonth,
  cloudState,
  onOpenProtection,
}: TodayScreenProps) {
  const units = useUnits();
  const {
    sortedActivities,
    today,
    recentDays,
    lastFeed,
    lastBottle,
    activeNursing,
    activeBurp,
    activeTummy,
    activeSleep,
    activeTimers,
    typicalGap,
    forecasts,
    rhythm,
  } = stats;

  // The companion notices the moment a completed care entry lands: the entry
  // id keys a one-shot heart on the drawn baby. Timer starts don't count —
  // the reaction is for finished care, not a running stopwatch.
  const [reactionKey, setReactionKey] = useState<string | null>(null);

  // The recap can walk back through whole days without leaving Today: 0 is
  // today, 1 is yesterday. Bounded by the first thing ever logged so the
  // arrows never step into blank prehistory — or into tomorrow.
  const [dayOffset, setDayOffset] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const forecastFeedSheet: "bottle" | "nursing" = profile.feedingMode === "breast"
    ? "nursing"
    : profile.feedingMode === "bottle"
      ? "bottle"
      : lastFeed?.type === "nursing" ? "nursing" : "bottle";

  // Every timer now runs in its own tile, so a row is only for one that has
  // no tile on screen — a nursing session still going for a family that has
  // since switched to bottles only. Rare, and it must never go invisible.
  const lastMedicine = sortedActivities.find((activity) => activity.type === "medicine");
  const lastSolid = sortedActivities.find((activity) => activity.type === "solid");
  const nursingTileShown = profile.feedingMode !== "bottle";
  const homelessTimers = activeTimers.filter((timer) =>
    timer.type === "nursing" ? !nursingTileShown : timer.type !== "sleep" && timer.type !== "burp" && timer.type !== "tummy",
  );
  const gapElapsed = lastFeed
    ? minutesBetween(lastFeed.startedAt, new Date(minuteClock).toISOString())
    : 0;
  const gapOver = Math.max(0, gapElapsed - typicalGap);

  // What is probably next, in one place. A row appears only once the thing it
  // forecasts has been logged at all — greeting a fresh install with three
  // "still learning" lines is noise about the app, not help with the baby.
  const comingUp: ComingUpEntry[] = [];
  if (lastFeed && !activeNursing) {
    comingUp.push({
      type: profile.feedingMode === "breast" ? "nursing" : "bottle",
      label: "Feed",
      forecast: forecasts.feed,
      waiting: {
        headline: "Still learning the rhythm",
        hint: "A few more feeds and the pattern appears.",
      },
      gone: {
        headline: "Past the usual window",
        hint: gapOver > 0 && typicalGap > 0
          ? `${humanDuration(gapOver)} past the usual ${humanDuration(typicalGap)} gap — follow the cues`
          : "Follow the cues — whenever works",
      },
      action: {
        label: "Log",
        onClick: () => onOpenSheet(forecastFeedSheet),
        ariaLabel: "Log a feed",
      },
    });
  }
  if (!activeSleep && sortedActivities.some((activity) => activity.type === "sleep")) {
    comingUp.push({
      type: "sleep",
      label: "Sleep",
      forecast: forecasts.sleep,
      waiting: {
        headline: "Still learning the rhythm",
        hint: "A few more sleeps and the pattern appears.",
      },
      gone: {
        headline: "Past the usual window",
        hint: "Follow the cues — whenever works",
      },
      action: {
        label: "Start",
        onClick: toggleSleep,
        ariaLabel: "Start sleep timer",
      },
    });
  }
  if (sortedActivities.some((activity) => activity.type === "diaper")) {
    comingUp.push({
      type: "diaper",
      label: "Diaper",
      forecast: forecasts.diaper,
      // Nappies are the noisiest of the three and the forecast stays quiet
      // whenever the changes do not fall into a rhythm — so this line has to
      // be true both before there is data and when there is data that
      // disagrees with itself. It never promises the pattern will arrive.
      waiting: {
        headline: "No steady pattern",
        hint: "Diapers come when they come — check whenever something seems off.",
      },
      gone: {
        headline: "Past the usual window",
        hint: "Worth a check.",
      },
    });
  }

  // The list the family keeps, minus what today already has. Empty means the
  // card is not rendered at all — which covers both "nothing left to do" and
  // "this family keeps no list", and both deserve the same silence.
  const routines = profile.routines ?? [];
  const pendingToday = pendingRoutines(routines, sortedActivities, minuteClock);

  function tickRoutine(routine: Routine) {
    const entry: Activity = {
      id: makeId(),
      type: ROUTINE_TYPE,
      routineId: routine.id,
      // The label travels WITH the tick so the timeline can name it even
      // after the family removes the routine from their list.
      note: routine.label,
      startedAt: new Date().toISOString(),
    };
    // No confirmation: a mis-tap is caught by the same undo toast every other
    // log gets, and asking twice about a vitamin is how a card becomes a chore.
    if (onAdd(entry, `${routine.label} done`)) track("routine_ticked");
  }

  function quickLogBottle() {
    if (!lastBottle?.amount) {
      onOpenSheet("bottle");
      return;
    }
    const entry: Activity = {
      id: makeId(),
      type: "bottle",
      startedAt: new Date().toISOString(),
      amount: lastBottle.amount,
      milkType: lastBottle.milkType ?? "formula",
    };
    if (onAdd(entry, `${formatVolume(lastBottle.amount ?? 0, units)} bottle saved`)) {
      setReactionKey(entry.id);
      track("bottle_logged", { source: "quick_repeat", amount: mlBucket(lastBottle.amount) });
    }
  }

  function quickStartNursing(side: "left" | "right") {
    if (activeNursing) return;
    const entry: Activity = {
      id: makeId(),
      type: "nursing",
      startedAt: new Date().toISOString(),
      side,
    };
    if (onAdd(entry, `Nursing started · ${side} side`)) track("nursing_started", { side });
  }

  function stopNursing() {
    if (!activeNursing) return;
    track("nursing_stopped", { side: activeNursing.side ?? "unknown" });
    onStopTimer(activeNursing.id);
  }

  function quickLogDiaper(kind: DiaperKind) {
    const entry: Activity = {
      id: makeId(),
      type: "diaper",
      diaperKind: kind,
      startedAt: new Date().toISOString(),
    };
    if (
      onAdd(entry, `${kind === "both" ? "Wet + dirty" : kind === "dirty" ? "Dirty" : "Wet"} diaper saved`)
    ) {
      setReactionKey(entry.id);
      track("diaper_logged", { kind });
    }
  }

  // A stopwatch, not a counter: one tap starts it, one tap stops it. The
  // reading is the whole point — nothing about it is totalled anywhere.
  function toggleSleep() {
    if (activeSleep) {
      onStopTimer(activeSleep.id);
      track("sleep_stopped");
      return;
    }
    const entry: Activity = {
      id: makeId(),
      type: "sleep",
      startedAt: new Date().toISOString(),
    };
    if (onAdd(entry, "Sleep timer started")) track("sleep_started");
  }

  // Asked for from the feedback box by a mum timing tummy time with the burp
  // timer: its own timer, and today's total under it — the guidance is a
  // daily amount, built up in short goes.
  function startTummy() {
    const entry: Activity = { id: makeId(), type: "tummy", startedAt: new Date().toISOString() };
    if (onAdd(entry, "Tummy time started")) track("tummy_started");
  }
  // Added up to the second and rounded once: a newborn's goes are often under
  // a minute each, and rounding every one first turned three of them into 0m.
  const tummyTodayMs = sortedActivities
    .filter((activity) => activity.type === "tummy" && activity.endedAt && isSameDay(activity.startedAt, new Date(minuteClock)))
    .reduce((total, activity) => total + Math.max(0, new Date(activity.endedAt!).getTime() - new Date(activity.startedAt).getTime()), 0);

  function toggleBurp() {
    if (activeBurp) {
      track("burp_stopped");
      onStopTimer(activeBurp.id);
      return;
    }
    const entry: Activity = {
      id: makeId(),
      type: "burp",
      startedAt: new Date().toISOString(),
    };
    if (onAdd(entry, "Burping timer started")) track("burp_started");
  }

  const selectedDay = new Date(minuteClock);
  selectedDay.setHours(12, 0, 0, 0);
  selectedDay.setDate(selectedDay.getDate() - dayOffset);
  // Calendar days back to the first entry, counted noon to noon like
  // selectedDay — not elapsed 24-hour spans, which left a first entry at 23:59
  // out of reach until the clock passed 23:59 again. Rounded, so a 23- or
  // 25-hour clock-change day still counts as one.
  const oldestActivity = sortedActivities[sortedActivities.length - 1];
  let maxDayOffset = 0;
  if (oldestActivity) {
    const todayNoon = new Date(minuteClock);
    todayNoon.setHours(12, 0, 0, 0);
    const firstNoon = new Date(oldestActivity.startedAt);
    firstNoon.setHours(12, 0, 0, 0);
    maxDayOffset = Math.max(0, Math.round((todayNoon.getTime() - firstNoon.getTime()) / 86_400_000));
  }
  const daySummary = dayOffset === 0
    ? today
    : summarizeDay(sortedActivities, selectedDay, minuteClock);
  const recapTitle = dayOffset === 0
    ? "Today so far"
    : formatTimelineDay(selectedDay.toISOString());

  const lastDiaper = sortedActivities.find((activity) => activity.type === "diaper");

  const babyAge = formatBabyAge(profile.birthDate, minuteClock);
  const babyDays = ageInDays(profile.birthDate, minuteClock);
  const tummyGoal = tummyGoalMinutes(babyDays);

  // Last night, in the morning. Recomputed on the minute clock like every
  // other figure on this screen, so it appears and retires on its own.
  const lastNight = isMorning(minuteClock) ? summarizeNight(sortedActivities, minuteClock) : null;
  // "Is this normal?" reads YESTERDAY — a day that is over. recentDays runs
  // oldest-first and ends with today, so the day before is second from last.
  const normal = typicalVerdict(recentDays[recentDays.length - 2], babyDays);

  // The app calling it right, as a picture. Offered only on a run the card
  // itself judges worth showing.
  function shareRhythm() {
    track("rhythm_shared", { checked: rhythm.feed.checked, hits: rhythm.feed.hits });
    void shareCardOnTap((cards) => cards.rhythmCard(profile.name, rhythm.feed), "numalog-rhythm.png", `${displayName} · ${shareLink("rhythm")}`);
  }
  const trimmedName = profile.name.trim();
  // Display-capitalize the name — "mia" typed at onboarding still
  // deserves a headline. The stored profile is never rewritten.
  const displayName = trimmedName
    ? trimmedName.charAt(0).toLocaleUpperCase() + trimmedName.slice(1)
    : "your baby";
  // Alternating sides is the usual rhythm — the tile quietly highlights the
  // opposite of the last logged side. Both choices stay one tap.
  const lastNursingSide = sortedActivities.find((a) => a.type === "nursing")?.side;
  const nextSide = lastNursingSide === "left" ? "right" : lastNursingSide === "right" ? "left" : null;
  const headline = !babyAge
    ? `Welcome, ${displayName}`
    : babyAge === "born today"
      ? `${displayName} — welcome to the world`
      : `${displayName} is ${babyAge} old`;
  // The companion mirrors the real baby from what is actually known: nursing
  // now → feeding; close to (or past) the usual feed gap → eyeing the bottle;
  // fed within the hour → content. Hunger outranks the hour, so a 3am cue
  // never gets a sleeping face; otherwise night mode means night.
  const isHungry = Boolean(lastFeed) &&
    (gapOver > 0 || (forecasts.feed.at !== null && forecasts.feed.at - minuteClock < 30 * 60_000));
  const companionMood: CompanionMood = activeNursing
    ? "feeding"
    : isHungry
      ? "hungry"
      : nightMode && gapElapsed >= 20
        ? "sleeping"
        : !lastFeed
          ? "awake"
          : gapElapsed < 60
            ? "content"
            : "awake";

  return (
    <section
      className={`screen today-screen${sortedActivities.length ? "" : " is-empty"}`}
      aria-labelledby="today-heading"
    >
      {celebration && (
        <Suspense fallback={null}>
          <MilestoneParty milestone={celebration} totals={milestoneTotals} onDismiss={onDismissCelebration} onAddMonth={onOpenMonth} monthHasPhoto={Boolean(monthNow?.photo)} />
        </Suspense>
      )}

      {/* Welcome hero: the companion's face greets first, the age counter
          does the maths ("Mia is 2 weeks old · day 15"), and one verified,
          age-matched fact sits underneath with its source in plain sight. */}
      <header className="welcome-hero">
        {/* The face is where a parent looks for the baby's picture: it opens
            the baby profile, and wears the photo once there is one. */}
        <button
          type="button"
          className={`welcome-face mood-${companionMood}`}
          aria-label={`${displayName}’s profile and picture`}
          onClick={() => onOpenSheet("profile")}
        >
          <BabyCompanion mood={companionMood} size={84} reactionKey={reactionKey} />
          {profile.photo && <FacePhoto photo={profile.photo} />}
        </button>
        <div className="welcome-copy">
          <span className="welcome-greeting t-label">{greeting()}</span>
          <h1 id="today-heading" className="t-title-1 welcome-headline">{headline}</h1>
          {/* The quiet truth about where the data lives — all four of them.
              A state, not a nudge: small, constant, honest. Unprotected taps
              open the doors; a synced one opens the details. */}
          <div className="welcome-pills">
            <button type="button" className={cloudState === "none" || cloudState === "revoked" ? "cloud-note" : "cloud-note is-good"} onClick={onOpenProtection}>
              {cloudState === "none" && <><CloudOff size={12} aria-hidden="true" /> On this phone only</>}
              {cloudState === "synced" && <><Cloud size={12} aria-hidden="true" /> Synced to the cloud</>}
              {cloudState === "syncing" && <><Cloud size={12} aria-hidden="true" /> Syncing…</>}
              {cloudState === "offline" && <><CloudOff size={12} aria-hidden="true" /> Offline — will catch up</>}
              {cloudState === "revoked" && <><CloudOff size={12} aria-hidden="true" /> Sync disconnected — tap to fix</>}
            </button>
            <VaccinePill vaccine={plannedVaccines.find((v) => dueSoon(v, minuteClock))} now={minuteClock} onOpen={() => onOpenSheet("vaccines")} />
            {monthNow && (
              <MonthsPill month={monthNow.month} photo={monthNow.photo} onOpenMonth={onOpenMonth} onOpenAlbum={() => onOpenSheet("months")} />
            )}
          </div>
          <p className="welcome-date">
            {statusDateFormat.format(new Date(minuteClock))}
            {babyDays !== null && <span className="welcome-day-count">Day {babyDays + 1}</span>}
          </p>
        </div>
      </header>

      {/* ANY running timer, not just nursing. A sleep or burping timer used to
          leave the tiles on top and put the running clock below them, so the
          thing a parent had just started was off the bottom of the screen and
          had to be scrolled to. Whatever is counting is what they came back to
          look at. */}
      {/* The first question of the morning, answered before it is asked, and
          ABOVE the tiles: inside the clock column it landed a screen and a
          half down, which is no use to anybody at seven. Mornings only, and
          only when the night holds something. */}
      {lastNight && <LastNight night={lastNight} name={profile.name} />}

      <div className={`today-dashboard${activeTimers.length > 0 ? " has-live" : ""}`}>
        <div className="today-main">
          {/* The fact rides in today-main: on mobile the tap tiles order
              first, so the reading material sits just after the buttons —
              never between a tired thumb and the log. */}
          {babyDays !== null && babyAge && (
            <Suspense fallback={null}>
              <FactOfTheDay babyDays={babyDays} babyAge={babyAge} displayName={displayName} />
            </Suspense>
          )}
          <div className="hearth">
            {!lastFeed ? (
              // First run: no em-dash figure pretending to be data — a calm
              // welcome instead.
              <div className="hearth-clock hearth-empty">
                <LittleBottle className="hearth-illustration" />
                <p className="t-title-2">Ready when you are</p>
                {/* Name the tiles this family actually has: a bottle-only
                    home has no Nursing tile, and nursing is Left/Right, not
                    one tap. */}
                <p className="t-meta">
                  {profile.feedingMode === "bottle"
                    ? "Log the first feed when it happens — one tap on Bottle."
                    : profile.feedingMode === "breast"
                      ? "Log the first feed when it happens — tap Left or Right under Nursing."
                      : "Log the first feed when it happens — one tap on Bottle or Nursing."}
                </p>
              </div>
            ) : (
              // The companion now greets from the hero above — the idle
              // hearth stays a clean, single-column clock. Past the usual
              // gap the numeral itself turns rose: state as color, not a
              // second line of text (the forecast row below carries words).
              <div className={`hearth-clock hearth-idle${gapOver > 0 ? " is-over" : ""}`}>
                <div className="hearth-copy">
                  <span className="t-label">Since last feed</span>
                  <p className="figure hearth-figure t-display">
                    <GapFigure startedAt={lastFeed.startedAt} now={minuteClock} />
                  </p>
                  <p className="hearth-meta">{lastFeedSummary(lastFeed, units)}</p>
                </div>
              </div>
            )}

            {homelessTimers.map((timer) => (
              <TimerRow
                key={timer.id}
                activity={timer}
                now={minuteClock}
                onStop={() => onStopTimer(timer.id)}
                onEdit={onEdit}
              />
            ))}

          </div>

          {/* Shown from the first thing ever logged. A fresh install skips it
              — four em-dashes read as breakage, not calm — but a quiet morning
              keeps the card, or the arrows back to yesterday vanish with it. */}
          {sortedActivities.length > 0 && (
            <DayRecap
              summary={daySummary}
              title={recapTitle}
              name={profile.name}
              stepper={maxDayOffset > 0 ? {
                onPrev: () => setDayOffset((value) => Math.min(maxDayOffset, value + 1)),
                onNext: () => setDayOffset((value) => Math.max(0, value - 1)),
                canPrev: dayOffset < maxDayOffset,
                canNext: dayOffset > 0,
              } : undefined}
            />
          )}

          {/* The question the numbers above are being asked in aid of. */}
          <NormalCheck verdict={normal} name={profile.name} />

          {/* Day-by-day totals: the question a single day cannot answer. Shown
              once there is more than one day of history to compare. */}
          {recentDays.filter(hasRoutineCare).length > 1 && (
            <TrendChart days={recentDays} />
          )}

          <DayBand
            className="today-band"
            day={dayOffset === 0 ? new Date(minuteClock) : selectedDay}
            activities={sortedActivities}
            now={minuteClock}
            mode={dayOffset === 0 ? "rolling" : "day"}
          />

          <div className="next-up">
            <div className="care-notes">
              <p><ShieldCheck size={14} aria-hidden="true" /> Safe sleep: back, firm flat surface, clear sleep space.</p>
            </div>
          </div>

          <div className="recent-section">
            <div className="mini-heading">
              <h2>Recent</h2>
              <Button variant="ghost" onClick={onSeeTimeline}>See all <ChevronRight size={16} aria-hidden="true" /></Button>
            </div>
            <Card size="sm" className="activity-list recent-list">
              <CardContent className="activity-list-content">
                {sortedActivities.length > 0 && (
                  <ItemGroup>
                    {sortedActivities.slice(0, 6).map((activity, index) => (
                      <div role="listitem" key={activity.id}>
                        {index > 0 && <ItemSeparator />}
                        <ActivityRow activity={activity} onEdit={onEdit} now={detailReadsClock(activity) ? minuteClock : undefined} />
                      </div>
                    ))}
                  </ItemGroup>
                )}
                {/* While the hearth's first-run scene is showing, Recent stays
                    text-only — one ambient illustration per screen. */}
                {!sortedActivities.length &&
                  (lastFeed ? (
                    <EmptyState text="Your day will appear here as you log it." />
                  ) : (
                    <div className="empty-state">
                      <p>Your day will appear here as you log it.</p>
                    </div>
                  ))}
              </CardContent>
            </Card>
          </div>
        </div>

        <section className="log-column" aria-label="One-tap baby care logging">
          {/* First in the column, above the tiles: it is the one thing here
              with a deadline, and it is gone the moment it is satisfied.
              Inside the column rather than beside it because CSS pulls this
              column to the top of the dashboard, and a sibling would be left
              at the bottom of the page. */}
          {pendingToday.length > 0 && (
            <Suspense fallback={null}>
              <DailyRoutines pending={pendingToday} total={routines.length} onTick={tickRoutine} />
            </Suspense>
          )}

          {/* Quick-track grid: four big app-style tiles, one thumb-sized tap
              each. Odd tile counts stretch the last tile so the grid never
              rags. Secondary flows (change amount, past session) ride along
              as small chips — never in the way of the main tap. */}
          <div className="quick-grid">
            {profile.feedingMode !== "breast" && (
              <div className="quick-tile tile-bottle">
                <button
                  type="button"
                  className="tile-main"
                  onClick={quickLogBottle}
                  aria-label={lastBottle?.amount
                    ? `Log ${lastBottle.amount} millilitres of ${lastBottle.milkType === "expressed" ? "breast milk" : "formula"} now`
                    : "Log a bottle"}
                >
                  <span className="activity-glyph glyph-bottle" aria-hidden="true"><ActivityGlyph type="bottle" /></span>
                  <span className="tile-title">Bottle</span>
                  <span className="tile-sub">
                    {lastBottle?.amount
                      ? `${formatVolume(lastBottle.amount, units)} · ${lastBottle.milkType === "expressed" ? "breast milk" : "formula"}`
                      : "Log the first feed"}
                  </span>
                </button>
                {lastBottle?.amount && (
                  <Button
                    variant="ghost"
                    className="tile-chip"
                    onClick={() => onOpenSheet("bottle")}
                    aria-label="Change bottle amount"
                  >
                    Change
                  </Button>
                )}
              </div>
            )}

            {profile.feedingMode !== "bottle" && activeNursing && (
              <TimerTile activity={activeNursing} onStop={stopNursing} onEdit={onEdit} />
            )}

            {profile.feedingMode !== "bottle" && !activeNursing && (
              <div className="quick-tile tile-nurse">
                <div className="tile-head">
                  <span className="activity-glyph glyph-nursing" aria-hidden="true"><ActivityGlyph type="nursing" /></span>
                  <span className="tile-title">Nursing</span>
                </div>
                <div className="tile-split">
                  <Button
                    variant="outline"
                    className={nextSide === "left" ? "is-next-side" : undefined}
                    onClick={() => quickStartNursing("left")}
                    aria-label={nextSide === "left"
                      ? "Start nursing timer on the left side — usually next"
                      : "Start nursing timer on the left side"}
                  >
                    Left
                  </Button>
                  <Button
                    variant="outline"
                    className={nextSide === "right" ? "is-next-side" : undefined}
                    onClick={() => quickStartNursing("right")}
                    aria-label={nextSide === "right"
                      ? "Start nursing timer on the right side — usually next"
                      : "Start nursing timer on the right side"}
                  >
                    Right
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  className="tile-chip"
                  onClick={onManualNursing}
                  aria-label="Add a completed nursing session manually"
                >
                  <History aria-hidden="true" />
                  Earlier
                </Button>
              </div>
            )}

            <div className="quick-tile tile-diaper">
              <div className="tile-head">
                <span className="activity-glyph glyph-diaper" aria-hidden="true"><ActivityGlyph type="diaper" /></span>
                <span className="tile-title">Diaper</span>
                {/* Asked for by a user: the question at the changing mat is
                    never "how many today", it is "how long has it been". */}
                {lastDiaper && (() => {
                  const since = minutesBetween(lastDiaper.startedAt, new Date(minuteClock).toISOString());
                  // Asked for from the feedback box: a photo of a nappy, for
                  // the doctor. Right after Dirty or Both is when it is taken,
                  // so for a quarter of an hour the time is the way to add one.
                  if (lastDiaper.diaperKind !== "wet" && !lastDiaper.photo && since < 15) {
                    return (
                      <button type="button" className="tile-since tile-since-photo" onClick={() => onEdit(lastDiaper)}>
                        {lastDiaper.diaperKind === "both" ? "Wet + dirty" : "Dirty"} · {humanDuration(since)} ago <span className="tile-started-edit">· <Camera size={12} aria-hidden="true" /> Add photo</span>
                      </button>
                    );
                  }
                  return <span className="tile-since">{humanDuration(since)} ago</span>;
                })()}
              </div>
              <div className="tile-split">
                <Button variant="outline" onClick={() => quickLogDiaper("wet")} aria-label="Log wet diaper">Wet</Button>
                <Button variant="outline" onClick={() => quickLogDiaper("dirty")} aria-label="Log dirty diaper">Dirty</Button>
                <Button variant="outline" onClick={() => quickLogDiaper("both")} aria-label="Log wet and dirty diaper">Both</Button>
              </div>
              {/* The diaper sheet — kind, time and a note — has existed since
                  the beginning with nothing anywhere that opened it. The three
                  buttons above log at NOW; this is the one for the change an
                  hour ago that nobody had a hand free for. */}
              <Button
                variant="ghost"
                className="tile-chip"
                onClick={() => onOpenSheet("diaper")}
                aria-label="Log a diaper change at a different time"
              >
                <History aria-hidden="true" />
                Earlier
              </Button>
            </div>

            {activeSleep && <TimerTile activity={activeSleep} onStop={() => onStopTimer(activeSleep.id)} onEdit={onEdit} />}

            {!activeSleep && (
              <div className="quick-tile tile-sleep">
                <button
                  type="button"
                  className="tile-main"
                  onClick={toggleSleep}
                  aria-label="Start sleep timer"
                >
                  <span className="activity-glyph glyph-sleep" aria-hidden="true"><ActivityGlyph type="sleep" /></span>
                  <span className="tile-title">Sleep</span>
                  <span className="tile-sub">Start the timer</span>
                </button>
                {/* The night you meant to log at the time. Without this the
                    only way to record a sleep was to have pressed a button as
                    it began, which is not how most nights go. */}
                <Button
                  variant="ghost"
                  className="tile-chip"
                  onClick={() => onOpenSheet("sleep")}
                  aria-label="Add a sleep that has already finished"
                >
                  <History aria-hidden="true" />
                  Earlier
                </Button>
              </div>
            )}

            {activeBurp && <TimerTile activity={activeBurp} onStop={() => onStopTimer(activeBurp.id)} onEdit={onEdit} />}

            {!activeBurp && (
              <div className="quick-tile tile-burp">
                <button
                  type="button"
                  className="tile-main"
                  onClick={toggleBurp}
                  aria-label="Start burping timer"
                >
                  <span className="activity-glyph glyph-burp" aria-hidden="true"><ActivityGlyph type="burp" /></span>
                  <span className="tile-title">Burp</span>
                  <span className="tile-sub">Start the timer</span>
                </button>
              </div>
            )}
          </div>

          {/* What is probably next, and how often the app has been right —
              directly under the taps it forecasts. It used to sit in the
              clock column below, which on a phone is a screen and a half
              past the only line anybody would ever quote about this app. */}
          <ComingUp
            entries={comingUp}
            now={minuteClock}
            name={profile.name}
            record={rhythm.feed}
            onShareRecord={shareRhythm}
          />

          {activeTummy ? (
            <TummyRunning
              activity={activeTummy}
              onStop={() => { track("tummy_stopped"); onStopTimer(activeTummy.id); }}
              onEdit={onEdit}
            />
          ) : (
            <Button variant="ghost" className="log-row log-row-secondary action-tummy" onClick={startTummy}>
              <span className="action-icon" aria-hidden="true"><Smile /></span>
              <span className="log-copy">
                <strong>Tummy time</strong>
                <small className={tummyGoal !== null && tummyTodayMs === 0 ? "tummy-none" : undefined}>
                  {tummyLine(tummyTodayMs, tummyGoal)}
                </small>
              </span>
              <ChevronRight size={16} className="log-chevron" aria-hidden="true" />
            </Button>
          )}
          <Button
            variant="ghost"
            className="log-row log-row-secondary action-growth"
            onClick={() => onOpenSheet("growth")}
          >
            <span className="action-icon" aria-hidden="true"><Weight /></span>
            <span className="log-copy">
              <strong>Growth</strong>
              <small>Weight, length, head</small>
            </span>
            <ChevronRight size={16} className="log-chevron" aria-hidden="true" />
          </Button>
          {/* Asked for from the feedback box: a section for vaccinations —
              public health center or private clinic, the schedule and what
              was given. Right under Growth, where parents found it; a dose
              that is late or due this week is also at the top of Today. */}
          <Button
            variant="ghost"
            className="log-row log-row-secondary action-vaccines"
            onClick={() => onOpenSheet("vaccines")}
          >
            <span className="action-icon" aria-hidden="true"><Syringe /></span>
            <span className="log-copy">
              <strong>Vaccines</strong>
              <small>
                {(() => {
                  const late = plannedVaccines.find((v) => dueLabel(v.due!, minuteClock).overdue);
                  const next = plannedVaccines.find((v) => !dueLabel(v.due!, minuteClock).overdue);
                  const nextWhen = next ? dueLabel(next.due!, minuteClock) : null;
                  if (late) {
                    const lateBy = -dueLabel(late.due!, minuteClock).days;
                    return (
                      <>
                        <span className="is-late">{late.vaccine ?? "Vaccine"} {lateBy} day{lateBy === 1 ? "" : "s"} late</span>
                        {next && nextWhen ? ` · next: ${next.vaccine ?? "vaccine"} ${nextWhen.inline}` : ""}
                      </>
                    );
                  }
                  if (next && nextWhen) return `Next: ${next.vaccine ?? "Vaccine"} ${nextWhen.inline}`;
                  if (lastVaccine) return `Last: ${vaccineLabel(lastVaccine)} · ${shortDay(new Date(lastVaccine.startedAt))}`;
                  return "What was given, and what is next";
                })()}
              </small>
            </span>
            <ChevronRight size={16} className="log-chevron" aria-hidden="true" />
          </Button>
          {/* Asked for from the feedback box: a monthly milestone note, and a
              monthly photo — in the parents' own words. */}
          <Button
            variant="ghost"
            className="log-row log-row-secondary action-months"
            onClick={() => onOpenSheet("months")}
          >
            <span className="action-icon" aria-hidden="true"><Images /></span>
            <span className="log-copy">
              <strong>Monthly photos</strong>
              <small>A photo and a note each month</small>
            </span>
            <ChevronRight size={16} className="log-chevron" aria-hidden="true" />
          </Button>
          {/* Breast-only families lose the Bottle tile, which is right — it is
              not their daily tap. But expressed milk goes into a bottle, and a
              bottle at a grandparent's house is an ordinary evening, and until
              now neither could be logged from this screen at all. The tile
              stays hidden; the route back exists. */}
          {profile.feedingMode === "breast" && (
            <Button
              variant="ghost"
              className="log-row log-row-secondary action-feed"
              onClick={() => onOpenSheet("bottle")}
            >
              <span className="action-icon" aria-hidden="true"><Milk /></span>
              <span className="log-copy">
                <strong>Bottle</strong>
                <small>Expressed milk or formula</small>
              </span>
              <ChevronRight size={16} className="log-chevron" aria-hidden="true" />
            </Button>
          )}
          {(() => {
            const months = profile.birthDate ? ageInMonths(profile.birthDate) : null;
            // Solids start around six months (AAP/NHS); the row shows a little
            // early — four months — because "we just started tastes" is
            // exactly when a parent goes looking for where to write it down.
            if (months !== null && months < 4) return null;
            return (
              <Button
                variant="ghost"
                className="log-row log-row-secondary action-solid"
                onClick={() => onOpenSheet("solid")}
              >
                <span className="action-icon" aria-hidden="true"><Utensils /></span>
                <span className="log-copy">
                  <strong>Solids</strong>
                  <small>{lastSolid ? `${lastSolid.food?.trim() || "Last food"} · ${humanDuration(minutesBetween(lastSolid.startedAt, new Date(minuteClock).toISOString()))} ago` : "First tastes, purées, finger food"}</small>
                </span>
                <ChevronRight size={16} className="log-chevron" aria-hidden="true" />
              </Button>
            );
          })()}
          {/* Take two of the sounds — real files this time, see
              domain/soothe.ts. The player itself lives in App, so the noise
              outlasts both its sheet and this screen. */}
          <Button
            variant="ghost"
            className="log-row log-row-secondary action-soothe"
            onClick={onOpenSoothe}
          >
            <span className="action-icon" aria-hidden="true"><Waves /></span>
            <span className="log-copy">
              <strong>Sounds</strong>
              <small>White noise and lullabies — back, and working</small>
            </span>
            <ChevronRight size={16} className="log-chevron" aria-hidden="true" />
          </Button>
          {/* The whole point is the timestamp. "Has she already had it, and did
              you give it or did I" is the question two exhausted people in one
              house get wrong, and it is the one mistake here that matters. */}
          <Button
            variant="ghost"
            className="log-row log-row-secondary action-medicine"
            onClick={() => onOpenSheet("medicine")}
          >
            <span className="action-icon" aria-hidden="true"><Pill /></span>
            <span className="log-copy">
              <strong>Medicine</strong>
              <small>
                {lastMedicine
                  ? `${lastMedicine.medicine?.trim() || "Last dose"} · ${humanDuration(minutesBetween(lastMedicine.startedAt, new Date(minuteClock).toISOString()))} ago`
                  : "Vitamin D, paracetamol, drops"}
              </small>
            </span>
            <ChevronRight size={16} className="log-chevron" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            className="log-row log-row-secondary action-health"
            onClick={() => onOpenSheet("health")}
          >
            <span className="action-icon" aria-hidden="true"><Thermometer /></span>
            <span className="log-copy">
              <strong>Health note</strong>
              <small>Temperature or note</small>
            </span>
            <ChevronRight size={16} className="log-chevron" aria-hidden="true" />
          </Button>
          {/* Asked for by a Greek dev on Reddit: he wanted to hand the app
              to his brother with a newborn, instantly, and found no way to.
              Native sheet on phones; a small dialog everywhere else. */}
          <Button
            variant="ghost"
            className="log-row log-row-secondary action-share"
            onClick={() => {
              track("app_share_opened", { from: "today" });
              setShareOpen(true);
            }}
          >
            <span className="action-icon" aria-hidden="true"><Gift /></span>
            <span className="log-copy">
              <strong>Tell another parent</strong>
              <small>Numalog is free — pass it on</small>
            </span>
            <ChevronRight size={16} className="log-chevron" aria-hidden="true" />
          </Button>
        </section>
      </div>

      {shareOpen && (
        <Suspense fallback={null}>
          <ShareNumalogDialog open={shareOpen} onOpenChange={setShareOpen} />
        </Suspense>
      )}
    </section>
  );
}

// Memoized: App re-renders on every minute tick, toast, sheet and sync flip,
// and this screen is the most expensive thing it renders. With stable
// callbacks from App, only a data change or the minute clock reaches it.
export default memo(TodayScreen);
