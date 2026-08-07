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
import { activityDetail, activityTitle } from "../domain/activityDisplay";
import { makeId } from "../domain/id";
import {
  forecastRange,
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
    feedsToday,
    bottleMlToday,
    diapersToday,
    sleepMinutesToday,
    lastFeed,
    lastBottle,
    activeSleep,
    activeNursing,
    activeTimers,
    feedingGaps,
    typicalGap,
    wakeGaps,
    feedSpread,
    nextFeedAt,
    sleepSpread,
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

  return (
    <section className="screen today-screen" aria-labelledby="today-heading">
      <header className="status-line">
        <h1 id="today-heading" className="t-title-2">{profile.name}</h1>
        <span className="status-date">{statusDateFormat.format(new Date(minuteClock))}</span>
      </header>

      <div className="today-dashboard">
        <div className="hearth">
          {activeNursing ? (
            <NursingHearth activity={activeNursing} onStop={stopNursing} />
          ) : (
            <div className="hearth-clock">
              <span className="t-label">Since last feed</span>
              <p className="figure hearth-figure t-display">
                <GapFigure startedAt={lastFeed?.startedAt} now={minuteClock} />
              </p>
              <p className="hearth-meta">
                {lastFeed
                  ? `${activityTitle(lastFeed)} · ${activityDetail(lastFeed)}`
                  : "Log the first feed when it happens."}
              </p>
              {lastFeed && typicalGap > 0 && (
                <>
                  <div className="micro-strip" aria-hidden="true">
                    {gapOver > 0 ? (
                      <>
                        <span
                          className="strip-fill"
                          style={{ width: `${(typicalGap / gapElapsed) * 100}%` }}
                        />
                        <span
                          className="strip-over"
                          style={{ width: `${(gapOver / gapElapsed) * 100}%` }}
                        />
                      </>
                    ) : (
                      <span
                        className="strip-fill"
                        style={{ width: `${(gapElapsed / typicalGap) * 100}%` }}
                      />
                    )}
                  </div>
                  <p className="micro-caption">
                    {gapOver > 0
                      ? `${humanDuration(gapOver)} past the usual ${humanDuration(typicalGap)} gap`
                      : `Usual gap between longer feeds: ${humanDuration(typicalGap)}`}
                  </p>
                </>
              )}
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

          {!activeNursing && (
            <div className="hearth-foot">
              <div className="log-copy">
                <span>Next likely feed</span>
                <strong>
                  {nextFeedAt ? forecastRelative(nextFeedAt, minuteClock) : "Learning the pattern"}
                </strong>
                <small>
                  {nextFeedAt
                    ? feedWindowPassed
                      ? `Based on ${feedingGaps.length} recent gaps`
                      : `${forecastRange(nextFeedAt, feedSpread)} · based on ${feedingGaps.length} recent gaps`
                    : "Log a few more feeds spaced 20 minutes to 8 hours apart"}
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
                <small>
                  {lastBottle?.amount
                    ? `Repeat ${lastBottle.milkType === "expressed" ? "breast milk" : "formula"}`
                    : "Set the amount once"}
                </small>
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
                      {lastBottle.amount} ml
                    </Button>
                    <Button variant="outline" onClick={() => onOpenSheet("bottle")}>Details</Button>
                  </>
                ) : (
                  <Button variant="outline" onClick={() => onOpenSheet("bottle")}>Set amount</Button>
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
              <small>Save the exact change</small>
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

        <div className="day-strip" aria-label="Today's summary">
          <div>
            <span className="figure t-numeral">
              {feedsToday.length > 0 ? feedsToday.length : <span className="is-zero">—</span>}
            </span>
            <span className="t-label">feeds</span>
          </div>
          <div>
            <span className="figure t-numeral">
              {bottleMlToday > 0 ? bottleMlToday : <span className="is-zero">—</span>}
            </span>
            <span className="t-label">ml logged</span>
          </div>
          <div>
            <span className="figure t-numeral">
              {diapersToday > 0 ? diapersToday : <span className="is-zero">—</span>}
            </span>
            <span className="t-label">diapers</span>
          </div>
          <div>
            <span className="figure t-numeral"><DurationFigure minutes={sleepMinutesToday} /></span>
            <span className="t-label">sleep</span>
          </div>
        </div>

        <DayBand
          className="today-band"
          day={new Date(minuteClock)}
          activities={sortedActivities}
          now={minuteClock}
        />

        <div className="next-up">
          {!activeSleep && (
            <div className="log-row action-sleep">
              <span className="action-icon"><Moon /></span>
              <div className="log-copy">
                <span>Next likely sleep</span>
                <strong>
                  {nextSleepAt ? forecastRelative(nextSleepAt, minuteClock) : "Learning the pattern"}
                </strong>
                <small>
                  {nextSleepAt
                    ? sleepWindowPassed
                      ? `Based on ${wakeGaps.length} recent wake windows`
                      : `${forecastRange(nextSleepAt, sleepSpread)} · based on ${wakeGaps.length} recent wake windows`
                    : "Log a few more complete sleeps to estimate a window"}
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
              {!sortedActivities.length && <EmptyState text="Your day will appear here as you log it." />}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
