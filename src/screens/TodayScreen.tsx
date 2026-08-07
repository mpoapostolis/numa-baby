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
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { ItemGroup, ItemSeparator } from "../components/ui/item";
import { Separator } from "../components/ui/separator";
import { ActiveTimerCard } from "../components/ActiveTimerCard";
import { ActivityRow } from "../components/ActivityRow";
import { EmptyState } from "../components/EmptyState";
import { InstantLogCard } from "../components/InstantLogCard";
import { QuickAction } from "../components/QuickAction";
import { activityDetail, activityTitle } from "../domain/activityDisplay";
import { makeId } from "../domain/id";
import {
  forecastRange,
  forecastRelative,
  formatTime,
  greeting,
  humanDuration,
  minutesBetween,
  timeAgo,
} from "../domain/time";
import { Activity, DiaperKind, Profile, Sheet } from "../domain/types";
import { ActivityStats } from "../hooks/useActivityStats";

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
      <div className="section-heading">
        <div>
          <p className="eyebrow">Today</p>
          <h1 id="today-heading">{greeting()}, {profile.name}.</h1>
          <p className="page-subtitle">Everything that matters today, without having to remember it.</p>
        </div>
      </div>

      <div className="today-dashboard">
        <div className="today-primary">
      {activeTimers.length > 0 && (
        <div className="active-stack" aria-label="Active timers">
          <div className="timer-heading">
            <span><i className="pulse" /> Running now</span>
            <small>{activeTimers.length} {activeTimers.length === 1 ? "timer" : "timers"}</small>
          </div>
          {activeTimers.map((timer) => (
            <ActiveTimerCard
              key={timer.id}
              activity={timer}
              onStop={() => onStopTimer(timer.id)}
            />
          ))}
        </div>
      )}

      <Card size="sm" className="now-card">
        <CardHeader className="now-card-top">
          <Badge variant="secondary" className="status-pill"><span /> Last feed</Badge>
          <span className="now-time">{lastFeed ? formatTime(lastFeed.startedAt) : "—"}</span>
        </CardHeader>
        <CardContent className="now-main">
          <div>
            <strong>{timeAgo(lastFeed?.startedAt, minuteClock)}</strong>
            <p>{lastFeed ? `${activityTitle(lastFeed)} · ${activityDetail(lastFeed)}` : "Log the first feed when it happens."}</p>
          </div>
          <Milk size={36} strokeWidth={1.7} />
        </CardContent>
        {typicalGap > 0 && (
          <CardFooter className="usual-row">
            <Clock size={15} />
            <span>Usual gap between longer feeds: {humanDuration(typicalGap)}</span>
          </CardFooter>
        )}
      </Card>

      <Card size="sm" className="summary-grid" aria-label="Today's summary">
        <div><strong>{feedsToday.length}</strong><span>feeds</span></div>
        <div><strong>{bottleMlToday}</strong><span>ml logged</span></div>
        <div><strong>{diapersToday}</strong><span>diapers</span></div>
        <div><strong>{humanDuration(sleepMinutesToday)}</strong><span>sleep</span></div>
      </Card>

      <Card size="sm" className="care-forecast" aria-labelledby="care-forecast-title">
        <CardHeader className="care-forecast-heading">
          <div>
            <p>From {profile.name}’s rhythm</p>
            <CardTitle id="care-forecast-title">What may be next</CardTitle>
          </div>
          <CardAction><Badge variant="outline">On-device</Badge></CardAction>
        </CardHeader>
        <CardContent className="forecast-grid">
          <div className="forecast-item forecast-feed">
            <span className="forecast-icon"><Milk size={21} /></span>
            <div className="forecast-copy">
              <span>{activeNursing ? "Current feed" : "Next likely feed"}</span>
              <strong>{activeNursing
                ? "Nursing now"
                : nextFeedAt ? forecastRelative(nextFeedAt, minuteClock) : "Learning the pattern"}</strong>
              <small>{activeNursing
                ? `Started ${formatTime(activeNursing.startedAt)}`
                : nextFeedAt
                  ? feedWindowPassed
                    ? `Based on ${feedingGaps.length} recent gaps`
                    : `${forecastRange(nextFeedAt, feedSpread)} · based on ${feedingGaps.length} recent gaps`
                  : "Log a few more feeds spaced 20 minutes to 8 hours apart"}</small>
            </div>
            {activeNursing ? (
              <Button variant="outline" size="sm" onClick={stopNursing}>Stop</Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => onOpenSheet(forecastFeedSheet)}>Log</Button>
            )}
          </div>
          <div className="forecast-item forecast-sleep">
            <span className="forecast-icon"><Moon size={21} /></span>
            <div className="forecast-copy">
              <span>{activeSleep ? "Current sleep" : "Next likely sleep"}</span>
              <strong>{activeSleep
                ? "Sleeping now"
                : nextSleepAt ? forecastRelative(nextSleepAt, minuteClock) : "Learning the pattern"}</strong>
              <small>{activeSleep
                ? `Started ${formatTime(activeSleep.startedAt)}`
                : nextSleepAt
                  ? sleepWindowPassed
                    ? `Based on ${wakeGaps.length} recent wake windows`
                    : `${forecastRange(nextSleepAt, sleepSpread)} · based on ${wakeGaps.length} recent wake windows`
                  : "Log a few more complete sleeps to estimate a window"}</small>
            </div>
            <Button variant="outline" size="sm" onClick={toggleSleep}>{activeSleep ? "Stop" : "Start"}</Button>
          </div>
        </CardContent>
        <CardFooter className="forecast-guidance">
          <span><Clock size={15} /> Patterns, not a schedule — cues and your clinician’s care plan come first.</span>
          <span><ShieldCheck size={15} /> Safe sleep: back, firm flat surface, clear sleep space.</span>
        </CardFooter>
      </Card>

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

      <Card size="sm" className="quick-section">
        <CardHeader className="quick-section-header">
          <div>
            <CardTitle>Log now</CardTitle>
            <CardDescription>Tap the exact action. Undo is always available.</CardDescription>
          </div>
          <CardAction><Badge variant="secondary">Private</Badge></CardAction>
        </CardHeader>
        <CardContent className="quick-section-content">
          <div className="instant-grid" aria-label="One-tap baby care logging">
          {profile.feedingMode !== "breast" && (
            <InstantLogCard
              className="action-feed"
              title="Bottle"
              description={lastBottle?.amount ? `Repeat ${lastBottle.milkType === "expressed" ? "breast milk" : "formula"}` : "Set the amount once"}
              icon={<Milk />}
            >
              {lastBottle?.amount ? (
                <>
                  <Button size="sm" onClick={quickLogBottle} aria-label={`Log ${lastBottle.amount} millilitres of ${lastBottle.milkType === "expressed" ? "breast milk" : "formula"} now`}>
                    {lastBottle.amount} ml
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onOpenSheet("bottle")}>Details</Button>
                </>
              ) : (
                <Button size="sm" onClick={() => onOpenSheet("bottle")}>Set amount</Button>
              )}
            </InstantLogCard>
          )}
          {profile.feedingMode !== "bottle" && (
            <InstantLogCard
              className="action-nurse"
              title={activeNursing ? "Nursing now" : "Nursing timer"}
              description={activeNursing ? `${activeNursing.side === "left" ? "Left" : "Right"} · ${humanDuration(minutesBetween(activeNursing.startedAt, new Date(minuteClock).toISOString()))}` : "Choose a side to start instantly"}
              icon={<Heart />}
            >
              {activeNursing ? (
                <Button size="sm" className="instant-stop" onClick={stopNursing}><Square fill="currentColor" /> Stop</Button>
              ) : (
                <>
                  <Button size="sm" onClick={() => quickStartNursing("left")} aria-label="Start nursing timer on the left side">Start left</Button>
                  <Button size="sm" onClick={() => quickStartNursing("right")} aria-label="Start nursing timer on the right side">Start right</Button>
                  <Button size="sm" variant="outline" onClick={onManualNursing} aria-label="Add a completed nursing session manually"><Clock /> Add past session</Button>
                </>
              )}
            </InstantLogCard>
          )}
          <InstantLogCard
            className="action-diaper"
            title="Diaper"
            description="Save the exact change"
            icon={<Droplet />}
          >
            <Button size="sm" onClick={() => quickLogDiaper("wet")}>Wet</Button>
            <Button size="sm" onClick={() => quickLogDiaper("dirty")}>Dirty</Button>
            <Button size="sm" variant="outline" onClick={() => quickLogDiaper("both")}>Both</Button>
          </InstantLogCard>
          <InstantLogCard
            className={`action-sleep ${activeSleep ? "is-active" : ""}`}
            title={activeSleep ? "Sleeping now" : "Sleep"}
            description={activeSleep ? humanDuration(minutesBetween(activeSleep.startedAt, new Date(minuteClock).toISOString())) : "Start a sleep timer"}
            icon={<Moon />}
          >
            <Button size="sm" className={activeSleep ? "instant-stop" : ""} onClick={toggleSleep}>
              {activeSleep ? <><Square fill="currentColor" /> Wake up</> : "Start sleep"}
            </Button>
          </InstantLogCard>
          </div>
          <Separator />
          <ItemGroup className="secondary-actions" aria-label="Measurements and health">
            <QuickAction className="action-growth" title="Growth" description="Weight, length, head" icon={<Weight />} onClick={() => onOpenSheet("growth")} trailing={<ChevronRight />} />
            <QuickAction className="action-health" title="Health note" description="Temperature or note" icon={<Thermometer />} onClick={() => onOpenSheet("health")} trailing={<ChevronRight />} />
          </ItemGroup>
        </CardContent>
      </Card>

      </div>
    </section>
  );
}
