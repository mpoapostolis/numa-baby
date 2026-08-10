import { useState } from "react";
import {
  ChevronRight,
  Droplet,
  ExternalLink,
  Heart,
  Milk,
  Moon,
  ShieldCheck,
  Square,
  Thermometer,
  Weight,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { ItemGroup, ItemSeparator } from "../components/ui/item";
import { ActivityGlyph } from "../components/ActivityGlyph";
import { ActivityRow } from "../components/ActivityRow";
import { DayBand } from "../components/DayBand";
import { EmptyState } from "../components/EmptyState";
import { LittleBottle, SleepyMoon, TinyStars } from "../components/illustrations";
import { BabyCompanion, CompanionMood } from "../components/BabyCompanion";
import { factOfTheDay } from "../domain/babyFacts";
import { makeId } from "../domain/id";
import {
  ageInDays,
  forecastRelative,
  formatBabyAge,
  formatTime,
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

// The Hearth while a nursing timer runs: the same block becomes the live
// timer — the only display-size numeral on screen. Digits changing are the
// only motion; the second clock lives here so the rest of Today ticks by
// the minute.
function NursingHearth({ activity, onStop }: { activity: Activity; onStop: () => void }) {
  const now = useSecondClock();
  return (
    <div className="hearth-clock">
      <span className="t-label hearth-live-label">
        Nursing · {activity.side === "left" ? "Left" : "Right"}
      </span>
      <p className="figure hearth-figure t-display">{liveDuration(activity.startedAt, now)}</p>
      <p className="hearth-meta">Started {formatTime(activity.startedAt)}</p>
      <Button className="hearth-stop" onClick={onStop} aria-label="Stop nursing timer">
        <Square size={14} fill="currentColor" aria-hidden="true" /> Stop
      </Button>
    </div>
  );
}

// Active sleep (and any orphaned timer from older data) renders as a 56px
// row below the Hearth — never a second display-size numeral.
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
  const title = isSleep
    ? "Sleeping now"
    : `Nursing · ${activity.side === "left" ? "Left" : "Right"}`;
  return (
    <div className="log-row timer-row">
      <span className={`activity-glyph glyph-${activity.type}`}>
        <ActivityGlyph type={activity.type} />
      </span>
      <div className="log-copy">
        <strong>{title}</strong>
        <small>
          Started {formatTime(activity.startedAt)} ·{" "}
          {humanDuration(minutesBetween(activity.startedAt, new Date(now).toISOString()))}
        </small>
      </div>
      <div className="log-actions">
        <Button onClick={onStop} aria-label={`Stop ${isSleep ? "sleep" : "nursing"} timer`}>
          <Square size={14} fill="currentColor" aria-hidden="true" /> {isSleep ? "Wake up" : "Stop"}
        </Button>
      </div>
    </div>
  );
}

type TodayScreenProps = {
  profile: Profile;
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
    todayActivities,
    feedsToday,
    bottleMlToday,
    diapersToday,
    sleepMinutesToday,
    lastFeed,
    lastBottle,
    activeSleep,
    activeNursing,
    activeTimers,
    typicalGap,
    nextFeedAt,
    nextSleepAt,
    feedWindowPassed,
    sleepWindowPassed,
  } = stats;

  // The companion notices the moment a completed care entry lands: the entry
  // id keys a one-shot heart on the drawn baby. Timer starts don't count —
  // the reaction is for finished care, not a running stopwatch.
  const [reactionKey, setReactionKey] = useState<string | null>(null);

  const forecastFeedSheet: "bottle" | "nursing" = profile.feedingMode === "breast"
    ? "nursing"
    : profile.feedingMode === "bottle"
      ? "bottle"
      : lastFeed?.type === "nursing" ? "nursing" : "bottle";

  const secondaryTimers = activeTimers.filter((timer) => timer.id !== activeNursing?.id);
  const gapElapsed = lastFeed
    ? minutesBetween(lastFeed.startedAt, new Date(minuteClock).toISOString())
    : 0;
  const gapOver = Math.max(0, gapElapsed - typicalGap);

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
    if (onAdd(entry, `${lastBottle.amount} ml bottle saved`)) setReactionKey(entry.id);
  }

  function quickStartNursing(side: "left" | "right") {
    if (activeNursing) return;
    const entry: Activity = {
      id: makeId(),
      type: "nursing",
      startedAt: new Date().toISOString(),
      side,
    };
    onAdd(entry, `Nursing started · ${side} side`);
  }

  function stopNursing() {
    if (!activeNursing) return;
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
    }
  }

  function toggleSleep() {
    if (activeSleep) {
      onStopTimer(activeSleep.id);
      return;
    }
    const entry: Activity = {
      id: makeId(),
      type: "sleep",
      startedAt: new Date().toISOString(),
    };
    onAdd(entry, "Sleep timer started");
  }

  const babyAge = formatBabyAge(profile.birthDate, minuteClock);
  const babyDays = ageInDays(profile.birthDate, minuteClock);
  // Alternating sides is the usual rhythm — the tile quietly highlights the
  // opposite of the last logged side. Both choices stay one tap.
  const lastNursingSide = sortedActivities.find((a) => a.type === "nursing")?.side;
  const nextSide = lastNursingSide === "left" ? "right" : lastNursingSide === "right" ? "left" : null;
  const babyName = profile.name.trim() || "your baby";
  // One verified fact per day, matched to the baby's exact age — the pick is
  // deterministic (see babyFacts.ts), so both parents see the same fact.
  const fact = babyDays === null ? null : factOfTheDay(babyDays);
  const headline = !babyAge
    ? `Welcome, ${babyName}`
    : babyAge === "born today"
      ? `${babyName} — welcome to the world`
      : `${babyName} is ${babyAge} old`;
  // The companion mirrors the real baby from the data already logged:
  // sleeping timer → asleep; close to (or past) the usual feed gap → eyeing
  // the bottle; fed within the hour → content; otherwise simply awake.
  const companionMood: CompanionMood = activeSleep
    ? "sleeping"
    : activeNursing
      ? "feeding"
      : !lastFeed
        ? "awake"
        : gapOver > 0 || (nextFeedAt !== null && nextFeedAt - minuteClock < 30 * 60_000)
          ? "hungry"
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

      {/* has-live is nursing-only: the live nursing figure + Stop ARE the 3am
          state. A background sleep timer is not — tiles stay first for the
          wake-up that follows tracked sleep. */}
      <div className={`today-dashboard${activeNursing ? " has-live" : ""}`}>
        <div className="today-main">
          {/* The fact rides in today-main: on mobile the tap tiles order
              first, so the reading material sits just after the buttons —
              never between a tired thumb and the log. */}
          {fact && babyAge && (
            <aside className="fact-card" aria-label="A fact about your baby at this age">
              <span className="fact-spark" aria-hidden="true"><TinyStars size={20} /></span>
              <div className="fact-copy">
                <span className="t-label">{babyAge === "born today" ? "From day one" : `At ${babyAge}`}</span>
                <p className="fact-text t-body">{fact.text}</p>
                <a
                  className="fact-source"
                  href={fact.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {fact.source.name} <ExternalLink size={12} aria-hidden="true" />
                </a>
              </div>
            </aside>
          )}
          <div className="hearth">
            {activeNursing ? (
              <NursingHearth activity={activeNursing} onStop={stopNursing} />
            ) : !lastFeed ? (
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

            {secondaryTimers.map((timer) => (
              <TimerRow
                key={timer.id}
                activity={timer}
                now={minuteClock}
                onStop={() => onStopTimer(timer.id)}
              />
            ))}

            {/* With zero feeds there is no pattern to forecast — the row waits
                for the first feed instead of announcing "Learning the pattern"
                over an empty tracker. */}
            {!activeNursing && lastFeed && (
              <div className="hearth-foot">
                <div className="log-copy">
                  <span className="t-label">Next likely feed</span>
                  <strong>
                    {nextFeedAt ? forecastRelative(nextFeedAt, minuteClock) : "Still learning the rhythm"}
                  </strong>
                  <small>
                    {nextFeedAt
                      ? feedWindowPassed
                        ? gapOver > 0 && typicalGap > 0
                          ? `${humanDuration(gapOver)} past the usual ${humanDuration(typicalGap)} gap — follow the cues`
                          : "Follow the cues — whenever works"
                        : `around ${formatTime(new Date(nextFeedAt).toISOString())}`
                      : "A few more feeds and the rhythm appears"}
                  </small>
                </div>
                <Button variant="outline" onClick={() => onOpenSheet(forecastFeedSheet)} aria-label="Log a feed">Log</Button>
              </div>
            )}
          </div>

          {/* Stats only once there is something to count — four em-dashes on a
              fresh install read as breakage, not calm. */}
          {(todayActivities.length > 0 || sleepMinutesToday > 0) && (
          <section className="day-strip" aria-label="Today's summary">
            <div className="stat-feeds">
              <span className="stat-head"><Heart size={14} aria-hidden="true" /> Feeds today</span>
              <span className="figure t-numeral">
                {feedsToday.length > 0 ? feedsToday.length : <span className="is-zero">—</span>}
              </span>
            </div>
            <div className="stat-bottle">
              <span className="stat-head"><Milk size={14} aria-hidden="true" /> Bottle total</span>
              <span className="figure t-numeral">
                {bottleMlToday > 0 ? (
                  <>
                    {bottleMlToday}
                    <span className="unit">ml</span>
                  </>
                ) : (
                  <span className="is-zero">—</span>
                )}
              </span>
            </div>
            <div className="stat-diaper">
              <span className="stat-head"><Droplet size={14} aria-hidden="true" /> Diapers</span>
              <span className="figure t-numeral">
                {diapersToday > 0 ? diapersToday : <span className="is-zero">—</span>}
              </span>
            </div>
            <div className="stat-sleep">
              <span className="stat-head"><Moon size={14} aria-hidden="true" /> Sleep today</span>
              <span className="figure t-numeral"><DurationFigure minutes={sleepMinutesToday} /></span>
            </div>
          </section>
          )}

          <DayBand
            className="today-band"
            day={new Date(minuteClock)}
            activities={sortedActivities}
            now={minuteClock}
            mode="rolling"
          />

          <div className="next-up">
            {/* Same rule as the feed forecast: no "Learning the pattern" over an
                empty tracker — the row waits for the first logged sleep. The
                plain "Start sleep" action above stays available regardless. */}
            {!activeSleep && sortedActivities.some((activity) => activity.type === "sleep") && (
              <div className="log-row action-sleep">
                {/* 40px render needs a heavier stroke than the 88px+ frames: 4/96 ≈ 1.7px on screen. */}
                <span className="action-icon forecast-illustration"><SleepyMoon size={40} strokeWidth={4} /></span>
                <div className="log-copy">
                  <span className="t-label">Next likely sleep</span>
                  <strong>
                    {nextSleepAt ? forecastRelative(nextSleepAt, minuteClock) : "Still learning the rhythm"}
                  </strong>
                  <small>
                    {nextSleepAt
                      ? sleepWindowPassed
                        ? "Follow the cues — whenever works"
                        : `around ${formatTime(new Date(nextSleepAt).toISOString())}`
                      : "A few more sleeps and the rhythm appears"}
                  </small>
                </div>
                <div className="log-actions">
                  <Button variant="outline" onClick={toggleSleep} aria-label="Start sleep timer">Start</Button>
                </div>
              </div>
            )}
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
              </div>
              <div className="tile-split">
                <Button variant="outline" onClick={() => quickLogDiaper("wet")} aria-label="Log wet diaper">Wet</Button>
                <Button variant="outline" onClick={() => quickLogDiaper("dirty")} aria-label="Log dirty diaper">Dirty</Button>
                <Button variant="outline" onClick={() => quickLogDiaper("both")} aria-label="Log wet and dirty diaper">Both</Button>
              </div>
            </div>

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
    </section>
  );
}
