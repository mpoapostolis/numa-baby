import {
  ChevronRight,
  Clock,
  Droplet,
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
import { LittleBottle, SleepyMoon } from "../components/illustrations";
import { BabyCompanion, CompanionMood } from "../components/BabyCompanion";
import { makeId } from "../domain/id";
import {
  forecastRelative,
  formatTime,
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

// "3 weeks" / "2 months" for the status line: weeks under 8, calendar
// months after, plain days in the first week. Null when there is no
// (usable) birth date — the line simply stays as it was.
function formatBabyAge(birthDate: string | undefined, now: number): string | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const birthMs = birth.getTime();
  if (Number.isNaN(birthMs) || birthMs > now) return null;
  const days = Math.floor((now - birthMs) / 86_400_000);
  const weeks = Math.floor(days / 7);
  if (days === 0) return "born today";
  if (weeks < 1) return days === 1 ? "1 day" : `${days} days`;
  if (weeks < 8) return weeks === 1 ? "1 week" : `${weeks} weeks`;
  const at = new Date(now);
  const months =
    (at.getFullYear() - birth.getFullYear()) * 12 +
    (at.getMonth() - birth.getMonth()) -
    (at.getDate() < birth.getDate() ? 1 : 0);
  if (months < 2) return `${weeks} weeks`;
  return `${months} months`;
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
        <Square size={14} fill="currentColor" /> Stop
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
          <Square size={14} fill="currentColor" /> {isSleep ? "Wake up" : "Stop"}
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
    onAdd(entry, `${lastBottle.amount} ml bottle saved`);
  }

  function quickStartNursing(side: "left" | "right") {
    if (activeNursing) return;
    const entry: Activity = {
      id: makeId(),
      type: "nursing",
      startedAt: new Date().toISOString(),
      side,
    };
    onAdd(entry, `${side === "left" ? "Left" : "Right"} timer started`);
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
    onAdd(entry, `${kind === "both" ? "Wet + dirty" : kind === "dirty" ? "Dirty" : "Wet"} diaper saved`);
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
      <header className="status-line">
        <h1 id="today-heading" className="t-title-2">
          {profile.name}
          {babyAge && <span className="status-age t-meta"> · {babyAge}</span>}
        </h1>
        <span className="status-date">{statusDateFormat.format(new Date(minuteClock))}</span>
      </header>

      <div className="today-dashboard">
        <div className="hearth">
          {activeNursing ? (
            <NursingHearth activity={activeNursing} onStop={stopNursing} />
          ) : !lastFeed ? (
            // First run: no em-dash figure pretending to be data — a calm
            // welcome instead.
            <div className="hearth-clock hearth-empty">
              <LittleBottle className="hearth-illustration" />
              <p className="t-title-2">Ready when you are</p>
              <p className="t-meta">Log the first feed when it happens — one tap on the right.</p>
            </div>
          ) : (
            <div className="hearth-clock hearth-idle">
              <div className="hearth-copy">
                <span className="t-label">Since last feed</span>
                <p className="figure hearth-figure t-display">
                  <GapFigure startedAt={lastFeed.startedAt} now={minuteClock} />
                </p>
                <p className="hearth-meta">{lastFeedSummary(lastFeed)}</p>
                {typicalGap > 0 && (
                  // One plain sentence — an unlabelled progress bar here read as
                  // "what is this?" instead of information.
                  <p className="micro-caption">
                    {gapOver > 0
                      ? `${humanDuration(gapOver)} past the usual ${humanDuration(typicalGap)} gap`
                      : `Usually feeds every ${humanDuration(typicalGap)}`}
                  </p>
                )}
              </div>
              <span className="hearth-ambient" aria-hidden="true">
                <BabyCompanion mood={companionMood} size={96} />
              </span>
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
                <span>Next likely feed</span>
                <strong>
                  {nextFeedAt ? forecastRelative(nextFeedAt, minuteClock) : "Still learning the rhythm"}
                </strong>
                <small>
                  {nextFeedAt
                    ? feedWindowPassed
                      ? "Follow the cues — whenever works"
                      : `around ${formatTime(new Date(nextFeedAt).toISOString())}`
                    : "A few more feeds and the pattern appears"}
                </small>
              </div>
              <Button variant="outline" onClick={() => onOpenSheet(forecastFeedSheet)}>Log</Button>
            </div>
          )}
        </div>

        <div className="log-column" aria-label="One-tap baby care logging">
          {profile.feedingMode !== "breast" && (
            <div className="log-row action-feed">
              <span className="action-icon"><Milk /></span>
              <div className="log-copy">
                <strong>Bottle</strong>
                {lastBottle?.amount && (
                  <small>{lastBottle.milkType === "expressed" ? "Breast milk" : "Formula"} · one tap</small>
                )}
              </div>
              <div className="log-actions">
                {lastBottle?.amount ? (
                  <>
                    <Button
                      variant="outline"
                      className="log-quiet"
                      onClick={quickLogBottle}
                      aria-label={`Log ${lastBottle.amount} millilitres of ${lastBottle.milkType === "expressed" ? "breast milk" : "formula"} now`}
                    >
                      Log {lastBottle.amount} ml
                    </Button>
                    <Button variant="outline" onClick={() => onOpenSheet("bottle")}>Change</Button>
                  </>
                ) : (
                  <Button variant="outline" onClick={() => onOpenSheet("bottle")}>Log a bottle</Button>
                )}
              </div>
            </div>
          )}

          {profile.feedingMode !== "bottle" && !activeNursing && (
            <div className="log-row action-nurse is-stacked">
              <span className="action-icon"><Heart /></span>
              <div className="log-copy">
                <strong>Nursing timer</strong>
                <small>Choose a side to start instantly</small>
              </div>
              <div className="log-actions">
                <Button
                  variant="outline"
                  onClick={() => quickStartNursing("left")}
                  aria-label="Start nursing timer on the left side"
                >
                  Start left
                </Button>
                <Button
                  variant="outline"
                  onClick={() => quickStartNursing("right")}
                  aria-label="Start nursing timer on the right side"
                >
                  Start right
                </Button>
                <Button
                  variant="outline"
                  className="span-full"
                  onClick={onManualNursing}
                  aria-label="Add a completed nursing session manually"
                >
                  <Clock /> Add past session
                </Button>
              </div>
            </div>
          )}

          <div className="log-row action-diaper">
            <span className="action-icon"><Droplet /></span>
            <div className="log-copy">
              <strong>Diaper</strong>
            </div>
            <div className="log-actions">
              <Button variant="outline" onClick={() => quickLogDiaper("wet")}>Wet</Button>
              <Button variant="outline" onClick={() => quickLogDiaper("dirty")}>Dirty</Button>
              <Button variant="outline" onClick={() => quickLogDiaper("both")}>Both</Button>
            </div>
          </div>

          {!activeSleep && (
            <div className="log-row action-sleep">
              <span className="action-icon"><Moon /></span>
              <div className="log-copy">
                <strong>Sleep</strong>
                <small>Start a sleep timer</small>
              </div>
              <div className="log-actions">
                <Button variant="outline" onClick={toggleSleep}>Start sleep</Button>
              </div>
            </div>
          )}

          <Button
            variant="ghost"
            className="log-row log-row-secondary action-growth"
            onClick={() => onOpenSheet("growth")}
          >
            <span className="action-icon"><Weight /></span>
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
            <span className="action-icon"><Thermometer /></span>
            <span className="log-copy">
              <strong>Health note</strong>
              <small>Temperature or note</small>
            </span>
            <ChevronRight size={16} className="log-chevron" aria-hidden="true" />
          </Button>
        </div>

        {/* Stats only once there is something to count — four em-dashes on a
            fresh install read as breakage, not calm. */}
        {(todayActivities.length > 0 || sleepMinutesToday > 0) && (
        <div className="day-strip" aria-label="Today's summary">
          <div>
            <span className="stat-head"><Milk size={14} aria-hidden="true" /> Feeds today</span>
            <span className="figure t-numeral">
              {feedsToday.length > 0 ? feedsToday.length : <span className="is-zero">—</span>}
            </span>
          </div>
          <div>
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
          <div>
            <span className="stat-head"><Droplet size={14} aria-hidden="true" /> Diapers</span>
            <span className="figure t-numeral">
              {diapersToday > 0 ? diapersToday : <span className="is-zero">—</span>}
            </span>
          </div>
          <div>
            <span className="stat-head"><Moon size={14} aria-hidden="true" /> Sleep today</span>
            <span className="figure t-numeral"><DurationFigure minutes={sleepMinutesToday} /></span>
          </div>
        </div>
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
                <span>Next likely sleep</span>
                <strong>
                  {nextSleepAt ? forecastRelative(nextSleepAt, minuteClock) : "Still learning the rhythm"}
                </strong>
                <small>
                  {nextSleepAt
                    ? sleepWindowPassed
                      ? "Follow the cues — whenever works"
                      : `around ${formatTime(new Date(nextSleepAt).toISOString())}`
                    : "A few more sleeps and the pattern appears"}
                </small>
              </div>
              <div className="log-actions">
                <Button variant="outline" onClick={toggleSleep}>Start</Button>
              </div>
            </div>
          )}
          <div className="care-notes">
            <p><Clock size={15} /> Patterns, not a schedule — cues and your clinician’s care plan come first.</p>
            <p><ShieldCheck size={15} /> Safe sleep: back, firm flat surface, clear sleep space.</p>
          </div>
        </div>

        <div className="recent-section">
          <div className="mini-heading">
            <h2>Recent</h2>
            <Button onClick={onSeeTimeline}>See all <ChevronRight size={15} /></Button>
          </div>
          <Card size="sm" className="activity-list recent-list">
            <CardContent className="activity-list-content">
              <ItemGroup>
                {sortedActivities.slice(0, 6).map((activity, index) => (
                  <div role="listitem" key={activity.id}>
                    {index > 0 && <ItemSeparator />}
                    <ActivityRow activity={activity} onEdit={onEdit} />
                  </div>
                ))}
              </ItemGroup>
              {!sortedActivities.length && (
                <EmptyState
                  illustration={<SleepyMoon />}
                  text="Your day will appear here as you log it."
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
