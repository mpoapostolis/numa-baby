import { Droplet, Milk, Moon, Stethoscope } from "lucide-react";
import { humanDuration, isSameDay, minutesOnDay } from "../domain/time";
import { Activity } from "../domain/types";

// 24-hour band with four labelled lanes: feed dots (filled = bottle, hollow =
// nursing), diaper ticks, sleep spans and growth/health diamonds. Each lane
// carries its own icon so the chart needs no decoding. The sleep lane is
// sourced from minutesOnDay overlap — never isSameDay on startedAt — so an
// overnight 23:00→06:00 sleep renders on both days it touches.

const DAY_MS = 86_400_000;

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
        <div className="band-lane">
          {!feedsOnly && <span className="band-lane-icon" title="Feeds"><Milk size={13} /></span>}
          <div className="band-track">
            {feeds.map((activity) => (
              <span
                key={activity.id}
                className={activity.type === "nursing" ? "band-dot is-hollow" : "band-dot"}
                style={{ left: `${pct(new Date(activity.startedAt).getTime())}%` }}
              />
            ))}
          </div>
        </div>
        {!feedsOnly && (
          <>
            <div className="band-lane">
              <span className="band-lane-icon" title="Diapers"><Droplet size={13} /></span>
              <div className="band-track">
                {diapers.map((activity) => (
                  <span
                    key={activity.id}
                    className="band-tick"
                    style={{ left: `${pct(new Date(activity.startedAt).getTime())}%` }}
                  />
                ))}
              </div>
            </div>
            <div className="band-lane">
              <span className="band-lane-icon" title="Sleep"><Moon size={13} /></span>
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
                      style={{ left: `${pct(from)}%`, width: `${Math.max(0.6, pct(to) - pct(from))}%` }}
                    />
                  );
                })}
              </div>
            </div>
            {marks.length > 0 && (
              <div className="band-lane">
                <span className="band-lane-icon" title="Measurements and notes"><Stethoscope size={13} /></span>
                <div className="band-track">
                  {marks.map((activity) => (
                    <span
                      key={activity.id}
                      className="band-mark"
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
      {hasNursing && hasBottle && (
        <p className="day-band-legend">
          <span><i className="band-dot" /> Bottle</span>
          <span><i className="band-dot is-hollow" /> Nursing</span>
        </p>
      )}
    </div>
  );
}
