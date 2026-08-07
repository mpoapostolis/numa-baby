import { Droplet, Milk, Moon, Stethoscope } from "lucide-react";
import { formatTime, humanDuration, isSameDay, minutesOnDay } from "../domain/time";
import { Activity } from "../domain/types";

// Multi-lane activity band, one hue per activity: bottle dots are filled blue,
// nursing dots are rose rings, diaper marks are teal squares and sleep spans
// are violet bars — the same glyph hues used on the log rows, so the chart
// needs no decoding. Two windows:
//   mode="rolling" (Today) — the LAST 24 HOURS ending at `now`, which sits at
//   the right edge. At 00:30 the band still shows yesterday's whole rhythm
//   instead of an almost-empty calendar day.
//   mode="day" (history) — a fixed calendar day.
// Empty windows render nothing (screens own their empty states). Sleep is
// included by overlap — never isSameDay on startedAt — so an overnight
// 23:00→06:00 sleep renders wherever it belongs.

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const CLUSTER_MS = 20 * 60_000; // feeds closer than this get nudged apart
const NUDGE_PX = [0, -3, 3];

type DayBandProps = {
  day: Date;
  activities: Activity[];
  now: number;
  mode?: "day" | "rolling";
  feedsOnly?: boolean;
  className?: string;
};

export function DayBand({
  day,
  activities,
  now,
  mode = "day",
  feedsOnly = false,
  className = "",
}: DayBandProps) {
  const rolling = mode === "rolling";
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const startMs = rolling ? now - DAY_MS : dayStart.getTime();
  const endMs = rolling ? now : dayStart.getTime() + DAY_MS;
  const span = endMs - startMs;
  const pct = (ms: number) => Math.min(100, Math.max(0, ((ms - startMs) / span) * 100));
  const inWindow = (value: string) => {
    const ms = new Date(value).getTime();
    return ms >= startMs && ms < endMs;
  };
  const includePoint = (value: string) => (rolling ? inWindow(value) : isSameDay(value, day));

  const feeds: Activity[] = [];
  const diapers: Activity[] = [];
  const sleeps: Activity[] = [];
  const marks: Activity[] = [];
  let sleepMinutes = 0;
  for (const activity of activities) {
    if (activity.type === "bottle" || activity.type === "nursing") {
      if (includePoint(activity.startedAt)) feeds.push(activity);
      continue;
    }
    if (feedsOnly) continue;
    if (activity.type === "sleep") {
      const sleepStart = new Date(activity.startedAt).getTime();
      const sleepEnd = activity.endedAt ? new Date(activity.endedAt).getTime() : now;
      const overlap = Math.min(sleepEnd, endMs) - Math.max(sleepStart, startMs);
      const minutes = rolling
        ? Math.max(0, Math.round(overlap / 60_000))
        : minutesOnDay(activity, day, now);
      if (minutes > 0) {
        sleeps.push(activity);
        sleepMinutes += minutes;
      }
      continue;
    }
    if (!includePoint(activity.startedAt)) continue;
    if (activity.type === "diaper") diapers.push(activity);
    else marks.push(activity);
  }

  // Nothing to show → render nothing: no icon gutters over blank tracks.
  if (feeds.length + diapers.length + sleeps.length + marks.length === 0) return null;

  // Feeds within ~20 min of each other stack on the same spot; nudge them
  // vertically so clusters stay countable.
  const sortedFeeds = [...feeds].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
  );
  const feedNudges = new Map<string, number>();
  let clusterIndex = 0;
  let previousMs = Number.NEGATIVE_INFINITY;
  for (const feed of sortedFeeds) {
    const ms = new Date(feed.startedAt).getTime();
    clusterIndex = ms - previousMs < CLUSTER_MS ? clusterIndex + 1 : 0;
    feedNudges.set(feed.id, NUDGE_PX[clusterIndex % NUDGE_PX.length]);
    previousMs = ms;
  }

  const showNow = rolling || (now >= startMs && now < endMs);
  const nowPct = rolling ? 100 : pct(now);

  // Clock ticks: every 6 hours in day mode; in rolling mode, the round
  // 6-o'clock hours that fall inside the sliding window (skipping any tick
  // that would crowd the edges).
  const ticks: Array<{ pct: number; label: string }> = [];
  if (rolling) {
    const firstTick = new Date(startMs);
    firstTick.setMinutes(0, 0, 0);
    firstTick.setHours(Math.ceil(firstTick.getHours() / 6) * 6);
    for (let ms = firstTick.getTime(); ms < endMs; ms += 6 * HOUR_MS) {
      const p = pct(ms);
      if (p < 4 || p > 93) continue;
      ticks.push({ pct: p, label: String(new Date(ms).getHours()).padStart(2, "0") });
    }
  } else {
    ticks.push({ pct: 0, label: "00" }, { pct: 25, label: "06" }, { pct: 50, label: "12" }, { pct: 75, label: "18" });
  }

  const parts = [`${feeds.length} ${feeds.length === 1 ? "feed" : "feeds"}`];
  if (!feedsOnly) {
    parts.push(`${diapers.length} ${diapers.length === 1 ? "diaper" : "diapers"}`);
    parts.push(sleepMinutes > 0 ? `${humanDuration(sleepMinutes)} sleep` : "no sleep logged");
    if (marks.length > 0) {
      parts.push(`${marks.length} ${marks.length === 1 ? "measurement or note" : "measurements and notes"}`);
    }
  }
  const hasNursing = feeds.some((activity) => activity.type === "nursing");
  const hasBottle = feeds.some((activity) => activity.type === "bottle");

  return (
    <div
      className={`day-band ${className}`.trim()}
      role="img"
      aria-label={`${rolling ? "Last 24 hours" : "24-hour overview"}: ${parts.join(", ")}.`}
      style={{ "--band-gutter": feedsOnly ? "0px" : "24px" } as React.CSSProperties}
    >
      <div className="day-band-lanes">
        {ticks.map((tick) => (
          <span
            key={tick.label + tick.pct}
            className="band-grid"
            style={{ left: `calc(var(--band-gutter) + (100% - var(--band-gutter)) * ${tick.pct / 100})` }}
          />
        ))}
        <div className="band-lane lane-feed">
          {!feedsOnly && <span className="band-lane-icon" title="Feeds"><Milk size={14} /></span>}
          <div className="band-track">
            {sortedFeeds.map((activity) => (
              <span
                key={activity.id}
                className={activity.type === "nursing" ? "band-dot is-nursing" : "band-dot is-bottle"}
                title={`${activity.type === "nursing" ? "Nursing" : "Bottle"} · ${formatTime(activity.startedAt)}`}
                style={
                  {
                    left: `${pct(new Date(activity.startedAt).getTime())}%`,
                    "--dot-nudge": `${feedNudges.get(activity.id) ?? 0}px`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        </div>
        {!feedsOnly && (
          <>
            <div className="band-lane lane-diaper">
              <span className="band-lane-icon" title="Diapers"><Droplet size={14} /></span>
              <div className="band-track">
                {diapers.map((activity) => (
                  <span
                    key={activity.id}
                    className="band-square"
                    title={`Diaper · ${formatTime(activity.startedAt)}`}
                    style={{ left: `${pct(new Date(activity.startedAt).getTime())}%` }}
                  />
                ))}
              </div>
            </div>
            <div className="band-lane lane-sleep">
              <span className="band-lane-icon" title="Sleep"><Moon size={14} /></span>
              <div className="band-track">
                {sleeps.map((activity) => {
                  const from = Math.max(new Date(activity.startedAt).getTime(), startMs);
                  const to = Math.min(
                    activity.endedAt ? new Date(activity.endedAt).getTime() : now,
                    endMs,
                  );
                  return (
                    <span
                      key={activity.id}
                      className={activity.endedAt ? "band-span" : "band-span is-open"}
                      title={`Sleep · ${formatTime(activity.startedAt)}–${
                        activity.endedAt ? formatTime(activity.endedAt) : "now"
                      }`}
                      style={{ left: `${pct(from)}%`, width: `${Math.max(0.8, pct(to) - pct(from))}%` }}
                    />
                  );
                })}
              </div>
            </div>
            {marks.length > 0 && (
              <div className="band-lane lane-mark">
                <span className="band-lane-icon" title="Measurements and notes"><Stethoscope size={14} /></span>
                <div className="band-track">
                  {marks.map((activity) => (
                    <span
                      key={activity.id}
                      className="band-mark"
                      title={`${activity.type === "growth" ? "Growth" : "Health"} · ${formatTime(activity.startedAt)}`}
                      style={{ left: `${pct(new Date(activity.startedAt).getTime())}%` }}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        {showNow && (
          <span
            className={rolling ? "band-now is-edge" : "band-now"}
            style={{ left: `calc(var(--band-gutter) + (100% - var(--band-gutter)) * ${nowPct / 100})` }}
          >
            <i>now</i>
          </span>
        )}
      </div>
      {rolling ? (
        <div className="day-band-scale is-rolling">
          {ticks.map((tick) => (
            <span
              key={tick.label + tick.pct}
              style={{ left: `calc(var(--band-gutter) + (100% - var(--band-gutter)) * ${tick.pct / 100})` }}
            >
              {tick.label}
            </span>
          ))}
        </div>
      ) : (
        <div className="day-band-scale">
          {ticks.map((tick) => (
            <span key={tick.label}>{tick.label}</span>
          ))}
        </div>
      )}
      {!feedsOnly && (
        <p className="day-band-legend">
          {hasBottle && <span><i className="key-swatch key-bottle" /> Bottle</span>}
          {hasNursing && <span><i className="key-swatch key-nursing" /> Nursing</span>}
          {diapers.length > 0 && <span><i className="key-swatch key-diaper" /> Diaper</span>}
          {sleeps.length > 0 && <span><i className="key-swatch key-sleep" /> Sleep</span>}
        </p>
      )}
    </div>
  );
}
