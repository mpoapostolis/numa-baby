import { Droplet, Milk, Moon, Stethoscope } from "lucide-react";
import { formatTime, humanDuration, isSameDay, minutesOnDay } from "../domain/time";
import { Activity } from "../domain/types";

// 24-hour band with labelled lanes, one hue per activity: bottle dots are
// filled blue, nursing dots are rose rings, diaper marks are teal squares and
// sleep spans are violet bars — the same glyph hues used on the log rows, so
// the chart needs no decoding. Empty days render nothing (screens own their
// empty states). The sleep lane is sourced from minutesOnDay overlap — never
// isSameDay on startedAt — so an overnight 23:00→06:00 sleep renders on both
// days it touches.

const DAY_MS = 86_400_000;
const CLUSTER_MS = 20 * 60_000; // feeds closer than this get nudged apart
const NUDGE_PX = [0, -3, 3];

type DayBandProps = {
  day: Date;
  activities: Activity[];
  now: number;
  feedsOnly?: boolean;
  className?: string;
};

export function DayBand({ day, activities, now, feedsOnly = false, className = "" }: DayBandProps) {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const startMs = dayStart.getTime();
  const pct = (ms: number) => Math.min(100, Math.max(0, ((ms - startMs) / DAY_MS) * 100));

  const feeds: Activity[] = [];
  const diapers: Activity[] = [];
  const sleeps: Activity[] = [];
  const marks: Activity[] = [];
  let sleepMinutes = 0;
  for (const activity of activities) {
    if (activity.type === "bottle" || activity.type === "nursing") {
      if (isSameDay(activity.startedAt, day)) feeds.push(activity);
      continue;
    }
    if (feedsOnly) continue;
    if (activity.type === "sleep") {
      const minutes = minutesOnDay(activity, day, now);
      if (minutes > 0) {
        sleeps.push(activity);
        sleepMinutes += minutes;
      }
      continue;
    }
    if (!isSameDay(activity.startedAt, day)) continue;
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

  const isToday = now >= startMs && now < startMs + DAY_MS;
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
      aria-label={`24-hour overview: ${parts.join(", ")}.`}
      style={{ "--band-gutter": feedsOnly ? "0px" : "24px" } as React.CSSProperties}
    >
      <div className="day-band-lanes">
        {[25, 50, 75].map((stop) => (
          <span
            key={stop}
            className="band-grid"
            style={{ left: `calc(var(--band-gutter) + (100% - var(--band-gutter)) * ${stop / 100})` }}
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
                    startMs + DAY_MS,
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
        {isToday && (
          <span
            className="band-now"
            style={{ left: `calc(var(--band-gutter) + (100% - var(--band-gutter)) * ${pct(now) / 100})` }}
          >
            <i>now</i>
          </span>
        )}
      </div>
      <div className="day-band-scale">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
      </div>
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
