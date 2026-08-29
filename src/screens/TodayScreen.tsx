import { Suspense, lazy, useState } from "react";
import { ChevronRight, ExternalLink, Milk, ShieldCheck, Square, Thermometer, Waves, Weight } from "lucide-react";

import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { ItemGroup, ItemSeparator } from "../components/ui/item";
import { ActivityGlyph } from "../components/ActivityGlyph";
import { ActivityRow } from "../components/ActivityRow";
import { DayBand } from "../components/DayBand";
import { ComingUp, ComingUpEntry } from "../components/ComingUp";
import { DayRecap } from "../components/DayRecap";
import { TrendChart } from "../components/TrendChart";
// The noise generator is only needed once someone asks for it, so it stays
// out of the bundle every parent downloads.
const SoothePlayer = lazy(() =>
  import("../components/SoothePlayer").then((m) => ({ default: m.SoothePlayer })),
);
import { EmptyState } from "../components/EmptyState";
import { LittleBottle, TinyStars } from "../components/illustrations";
import { BabyCompanion, CompanionMood } from "../components/BabyCompanion";
import { mlBucket, track } from "../domain/analytics";
import { bracketOfAge, factOfTheDay } from "../domain/babyFacts";
import { summarizeDay } from "../domain/daySummary";
import { makeId } from "../domain/id";
import {
  ageInDays,
  formatBabyAge,
  formatTime,
  formatTimelineDay,
  greeting,
  humanDuration,
  liveDuration,
  minutesBetween,
} from "../domain/time";
import { Activity, DiaperKind, Profile, Sheet } from "../domain/types";
import { ActivityStats } from "../hooks/useActivityStats";
import { useSecondClock } from "../hooks/useMinuteClock";

const statusDateFormat = new Intl.DateTimeFormat("en", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

// The Hearth meta line stays short: the last feed at a glance, not the full
// timeline entry — ranges and edit affordances live in Recent and Timeline.
function lastFeedSummary(feed: Activity) {
  if (feed.type === "bottle") {
    return `Bottle · ${feed.amount ?? 0} ml`;
  }
  const side = feed.side === "left" ? "left" : "right";
  return feed.endedAt
    ? `Nursing · ${side} · ${humanDuration(minutesBetween(feed.startedAt, feed.endedAt))}`
    : `Nursing · ${side}`;
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

/** "Both" is a real answer for a nursing session, not a missing one. */
function sideLabel(side: Activity["side"]) {
  return side === "both" ? "Both" : side === "left" ? "Left" : "Right";
}

// A running timer stays in the tile that started it.
//
// It used to vanish from the grid and reappear as a row somewhere else, which
// meant the tiles reflowed under a thumb mid-tap and the thing just started
// was the one thing not on screen. One place per activity, always the same
// place: tap Sleep and the Sleep tile becomes the clock.
function TimerTile({ activity, onStop }: { activity: Activity; onStop: () => void }) {
  const isSleep = activity.type === "sleep";
  const isBurp = activity.type === "burp";
  const title = isSleep
    ? "Sleeping"
    : isBurp
      ? "Burping"
      : `Nursing · ${sideLabel(activity.side)}`;
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
      <p className="tile-started">Started {formatTime(activity.startedAt)}</p>
      <Button className="tile-stop" onClick={onStop} aria-label={`Stop ${activity.type} timer`}>
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
}: {
  activity: Activity;
  now: number;
  onStop: () => void;
}) {
  const isSleep = activity.type === "sleep";
  const isBurp = activity.type === "burp";
  const title = isSleep
    ? "Sleeping now"
    : isBurp
      ? "Burping"
      : `Nursing · ${sideLabel(activity.side)}`;
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
        <Button onClick={onStop} aria-label={`Stop ${activity.type} timer`}>
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
  onAdd: (activity: Activity, message: string) => boolean;
  onStopTimer: (id: string) => void;
  onOpenSheet: (sheet: Exclude<Sheet, null>) => void;
  onManualNursing: () => void;
  onEdit: (activity: Activity) => void;
  onSeeTimeline: () => void;
};

export default function TodayScreen({
  profile,
  nightMode,
  minuteClock,
  stats,
  onAdd,
  onStopTimer,
  onOpenSheet,
  onManualNursing,
  onEdit,
  onSeeTimeline,
}: TodayScreenProps) {
  const {
    sortedActivities,
    today,
    recentDays,
    lastFeed,
    lastBottle,
    activeNursing,
    activeBurp,
    activeSleep,
    activeTimers,
    typicalGap,
    forecasts,
  } = stats;

  // The companion notices the moment a completed care entry lands: the entry
  // id keys a one-shot heart on the drawn baby. Timer starts don't count —
  // the reaction is for finished care, not a running stopwatch.
  const [reactionKey, setReactionKey] = useState<string | null>(null);

  // The recap can walk back through whole days without leaving Today: 0 is
  // today, 1 is yesterday. Bounded by the first thing ever logged so the
  // arrows never step into blank prehistory — or into tomorrow.
  const [dayOffset, setDayOffset] = useState(0);
  const [sootheOpen, setSootheOpen] = useState(false);
  // White noise has to survive its own sheet being closed. Rendering the
  // player only while the sheet is open unmounted the <audio> element the
  // moment a parent tapped away — so the one thing they opened it for stopped,
  // in the dark, with a baby half asleep. Once opened it stays mounted for the
  // rest of the visit and the sheet is only its face.
  const [sootheMounted, setSootheMounted] = useState(false);

  const forecastFeedSheet: "bottle" | "nursing" = profile.feedingMode === "breast"
    ? "nursing"
    : profile.feedingMode === "bottle"
      ? "bottle"
      : lastFeed?.type === "nursing" ? "nursing" : "bottle";

  // Every timer now runs in its own tile, so a row is only for one that has
  // no tile on screen — a nursing session still going for a family that has
  // since switched to bottles only. Rare, and it must never go invisible.
  const nursingTileShown = profile.feedingMode !== "bottle";
  const homelessTimers = activeTimers.filter((timer) =>
    timer.type === "nursing" ? !nursingTileShown : timer.type !== "sleep" && timer.type !== "burp",
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
        hint: "Nappies come when they come — check whenever something seems off.",
      },
      gone: {
        headline: "Past the usual window",
        hint: "Worth a check.",
      },
    });
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
    if (onAdd(entry, `${lastBottle.amount} ml bottle saved`)) {
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
  const oldestActivity = sortedActivities[sortedActivities.length - 1];
  const maxDayOffset = oldestActivity
    ? Math.max(0, Math.floor((minuteClock - new Date(oldestActivity.startedAt).getTime()) / 86_400_000))
    : 0;
  const daySummary = dayOffset === 0
    ? today
    : summarizeDay(sortedActivities, selectedDay, minuteClock);
  const recapTitle = dayOffset === 0
    ? "Today so far"
    : formatTimelineDay(selectedDay.toISOString());

  const lastDiaper = sortedActivities.find((activity) => activity.type === "diaper");

  const babyAge = formatBabyAge(profile.birthDate, minuteClock);
  const babyDays = ageInDays(profile.birthDate, minuteClock);
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
  // One verified fact per day, matched to the baby's exact age — the pick is
  // deterministic (see babyFacts.ts), so both parents see the same fact.
  // The stage list ("right now she may be…") comes from the same bracket.
  const fact = babyDays === null ? null : factOfTheDay(babyDays);
  const stage = babyDays === null ? null : bracketOfAge(babyDays);
  const stageSources = stage && fact
    ? [...new Map(
        [...stage.doing.map((d) => d.source), fact.source].map((s) => [s.url, s]),
      ).values()]
    : [];
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
    <section className="screen today-screen" aria-labelledby="today-heading">
      {/* Welcome hero: the companion's face greets first, the age counter
          does the maths ("Mia is 2 weeks old · day 15"), and one verified,
          age-matched fact sits underneath with its source in plain sight. */}
      <header className="welcome-hero">
        <span className={`welcome-face mood-${companionMood}`} aria-hidden="true">
          <BabyCompanion mood={companionMood} size={84} reactionKey={reactionKey} />
        </span>
        <div className="welcome-copy">
          <span className="welcome-greeting t-label">{greeting()}</span>
          <h1 id="today-heading" className="t-title-1 welcome-headline">{headline}</h1>
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
      <div className={`today-dashboard${activeTimers.length > 0 ? " has-live" : ""}`}>
        <div className="today-main">
          {/* The fact rides in today-main: on mobile the tap tiles order
              first, so the reading material sits just after the buttons —
              never between a tired thumb and the log. */}
          {fact && stage && babyAge && (
            <aside className="fact-card" aria-label="What your baby is doing at this age">
              <span className="fact-spark" aria-hidden="true"><TinyStars size={20} /></span>
              <div className="fact-copy">
                <span className="t-label">
                  {babyAge === "born today"
                    ? "From day one"
                    : babyAge.startsWith("almost")
                      ? babyAge
                      : `At ${babyAge}`}
                </span>
                <p className="fact-doing-lead">Right now, {displayName} may be:</p>
                <ul className="fact-doing">
                  {stage.doing.map((item) => (
                    <li key={item.text}>{item.text}</li>
                  ))}
                </ul>
                <p className="fact-text t-body">
                  <strong className="fact-kicker">Did you know?</strong> {fact.text}
                </p>
                <p className="fact-foot">
                  <span className="fact-pace">Every baby has their own pace.</span>
                  {stageSources.map((source) => (
                    <a
                      key={source.url}
                      className="fact-source"
                      onClick={() => track("source_opened", { name: source.name })}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {source.name} <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  ))}
                </p>
              </div>
            </aside>
          )}
          <div className="hearth">
            {!lastFeed ? (
              // First run: no em-dash figure pretending to be data — a calm
              // welcome instead.
              <div className="hearth-clock hearth-empty">
                <LittleBottle className="hearth-illustration" />
                <p className="t-title-2">Ready when you are</p>
                <p className="t-meta">Log the first feed when it happens — one tap on Bottle or Nursing.</p>
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
                  <p className="hearth-meta">{lastFeedSummary(lastFeed)}</p>
                </div>
              </div>
            )}

            {homelessTimers.map((timer) => (
              <TimerRow
                key={timer.id}
                activity={timer}
                now={minuteClock}
                onStop={() => onStopTimer(timer.id)}
              />
            ))}

          </div>

          <ComingUp entries={comingUp} now={minuteClock} />

          {/* Shown from the first thing ever logged. A fresh install skips it
              — four em-dashes read as breakage, not calm — but a quiet morning
              keeps the card, or the arrows back to yesterday vanish with it. */}
          {sortedActivities.length > 0 && (
            <DayRecap
              summary={daySummary}
              title={recapTitle}
              stepper={maxDayOffset > 0 ? {
                onPrev: () => setDayOffset((value) => Math.min(maxDayOffset, value + 1)),
                onNext: () => setDayOffset((value) => Math.max(0, value - 1)),
                canPrev: dayOffset < maxDayOffset,
                canNext: dayOffset > 0,
              } : undefined}
            />
          )}

          {/* Day-by-day totals: the question a single day cannot answer. Shown
              once there is more than one day of history to compare. */}
          {recentDays.filter((day) => !day.isEmpty).length > 1 && (
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
                        <ActivityRow activity={activity} onEdit={onEdit} />
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
                      ? `${lastBottle.amount} ml · ${lastBottle.milkType === "expressed" ? "breast milk" : "formula"}`
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
              <TimerTile activity={activeNursing} onStop={stopNursing} />
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
                  Past
                </Button>
              </div>
            )}

            <div className="quick-tile tile-diaper">
              <div className="tile-head">
                <span className="activity-glyph glyph-diaper" aria-hidden="true"><ActivityGlyph type="diaper" /></span>
                <span className="tile-title">Diaper</span>
                {/* Asked for by a user: the question at the changing mat is
                    never "how many today", it is "how long has it been". */}
                {lastDiaper && (
                  <span className="tile-since">
                    {humanDuration(minutesBetween(lastDiaper.startedAt, new Date(minuteClock).toISOString()))} ago
                  </span>
                )}
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
                Past
              </Button>
            </div>

            {activeSleep && <TimerTile activity={activeSleep} onStop={() => onStopTimer(activeSleep.id)} />}

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
                  Past
                </Button>
              </div>
            )}

            {activeBurp && <TimerTile activity={activeBurp} onStop={() => onStopTimer(activeBurp.id)} />}

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
          <Button
            variant="ghost"
            className="log-row log-row-secondary action-soothe"
            onClick={() => { track("soothe_opened"); setSootheMounted(true); setSootheOpen(true); }}
          >
            <span className="action-icon" aria-hidden="true"><Waves /></span>
            <span className="log-copy">
              <strong>Sounds</strong>
              <small>White noise and lullabies</small>
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
        </section>
      </div>
      {sootheMounted && (
        <Suspense fallback={null}>
          <SoothePlayer open={sootheOpen} onOpenChange={setSootheOpen} />
        </Suspense>
      )}
    </section>
  );
}
