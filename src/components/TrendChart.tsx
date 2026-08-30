// Daily totals as a line: how much milk, how many feeds, how many wet or
// dirty nappies, one point per day. The question it answers is "is this week
// like last week", which a single day's numbers can never show.
//
// Deliberately not a judgement: no target line, no green/red, no "goal". The
// only emphasised point is today, because that is where the parent is.

import { useState } from "react";
import { track } from "../domain/analytics";
import { humanDuration } from "../domain/time";
import { mlToOz, useUnits } from "../domain/units";
import { DaySummary } from "../domain/daySummary";

type Series = {
  key: string;
  label: string;
  glyph: "bottle" | "nursing" | "diaper" | "sleep";
  hue: string;
  unit?: string;
  value: (day: DaySummary) => number;
};

const SERIES: Series[] = [
  { key: "ml", label: "Milk", glyph: "bottle", hue: "var(--glyph-bottle)", unit: "ml", value: (d) => d.ml },
  { key: "feeds", label: "Feeds", glyph: "nursing", hue: "var(--glyph-nursing)", value: (d) => d.feeds },
  { key: "wet", label: "Wet", glyph: "diaper", hue: "var(--glyph-diaper)", value: (d) => d.wet },
  // Every series wears its own activity pigment — the six hues are a
  // contract (tokens.css), and Dirty borrowing growth's honey broke it.
  { key: "dirty", label: "Dirty", glyph: "diaper", hue: "var(--glyph-diaper)", value: (d) => d.dirty },
  { key: "sleep", label: "Sleep", glyph: "sleep", hue: "var(--glyph-sleep)", unit: "m", value: (d) => d.sleepMinutes },
];

const dayFormat = new Intl.DateTimeFormat("en", { weekday: "short" });
const fullDayFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });

// Geometry in percentages, laid out with CSS rather than a stretched viewBox.
// The old chart used preserveAspectRatio="none", which distorted every slope
// with the card width — a line whose angle depends on the window is a chart
// that lies. Bars have no slope to distort.
const BAR_HEIGHT = 108;

export function TrendChart({ days: allDays }: { days: DaySummary[] }) {
  const [activeKey, setActiveKey] = useState(SERIES[0].key);
  const series = SERIES.find((s) => s.key === activeKey) ?? SERIES[0];
  const units = useUnits();
  // Bars are proportions, so only the WORDS convert: the millilitre series
  // reads in ounces when the phone does, and every number goes through fmt.
  const isVolume = series.key === "ml";
  // Sleep speaks in hours-and-minutes like everywhere else in the app —
  // "612m a day" is exactly the arithmetic this app promises to spare.
  const isSleep = series.key === "sleep";
  const unitLabel = isSleep ? undefined : isVolume && units === "us" ? "oz" : series.unit;
  const fmt = (value: number) =>
    isSleep
      ? humanDuration(Math.round(value))
      : isVolume && units === "us" ? String(Math.round(mlToOz(value) * 10) / 10) : String(value);

  // Days before anything was ever logged are not zero-milk days — they are
  // days this app was not being used. Plotting them as zero would draw a
  // cliff that reads as "she ate nothing", so the line starts where the
  // record starts.
  const firstLogged = allDays.findIndex((day) => !day.isEmpty);
  const days = firstLogged <= 0 ? allDays : allDays.slice(firstLogged);

  const values = days.map(series.value);
  // Headroom so the tallest bar never touches the average label above it.
  const peak = Math.max(...values, 0);
  // Headroom so the tallest bar never collides with the average label.
  const scaleMax = Math.max(peak, 1) * 1.15;
  const todayIndex = days.length - 1;
  // Averaged over the days that were LOGGED, not the days that happened to be
  // non-zero. A day with feeds but no dirty nappy is a real zero and belongs
  // in the denominator; leaving it out quietly inflates every average.
  const loggedDays = days.filter((day) => !day.isEmpty);
  const total = loggedDays.reduce((sum, day) => sum + series.value(day), 0);
  const trackedDays = loggedDays.length;
  const average = trackedDays > 0 ? Math.round(total / trackedDays) : 0;

  const description = `${series.label} per day. ${days
    .map((day) => day.isEmpty
      ? `${fullDayFormat.format(day.date)}: not logged`
      : `${fullDayFormat.format(day.date)}: ${fmt(series.value(day))}${unitLabel ? ` ${unitLabel}` : ""}`)
    .join(", ")}.`;

  return (
    <section className="trend-card" aria-label={`${series.label} over the last ${days.length} days`}>
      <header className="trend-head">
        <div className="trend-titles">
          <span className="t-label">Last {days.length} days</span>
          <p className="trend-average">
            {trackedDays > 0 ? (
              <>
                <strong className="figure">{fmt(average)}{unitLabel && <span className="unit">{unitLabel}</span>}</strong>
                <span> a day on average</span>
              </>
            ) : (
              <span>Nothing logged yet</span>
            )}
          </p>
        </div>
        {trackedDays > 0 && (
          <span className="trend-peak">
            peak {fmt(peak)}{unitLabel && <span className="unit">{unitLabel}</span>}
          </span>
        )}
      </header>

      {/* Plain toggle buttons, not the ARIA tabs pattern: tabs promise
          arrow-key navigation and panels this chart does not have. */}
      <div className="trend-tabs" role="group" aria-label="Choose what to chart">
        {SERIES.map((option) => (
          <button
            key={option.key}
            type="button"
            aria-pressed={option.key === activeKey}
            className={option.key === activeKey ? "trend-tab is-active" : "trend-tab"}
            style={{ "--trend-hue": option.hue } as React.CSSProperties}
            onClick={() => { track("trend_series_changed", { series: option.key }); setActiveKey(option.key); }}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div
        className="trend-plot"
        style={{ "--trend-hue": series.hue, height: `${BAR_HEIGHT}px` } as React.CSSProperties}
        role="img"
        aria-label={description}
      >
        <div className="trend-bars">
          {values.map((value, index) => (
            <div
              className={index === todayIndex ? "trend-bar is-today" : "trend-bar"}
              key={days[index].date.toISOString()}
              title={days[index].isEmpty
                ? `${fullDayFormat.format(days[index].date)}: not logged`
                : `${fullDayFormat.format(days[index].date)}: ${fmt(value)}${unitLabel ? ` ${unitLabel}` : ""}`}
            >
              {/* Three distinct states, because a day nobody logged is not a
                  day with none: a bar, a hairline for a logged zero, and
                  nothing at all for a day with no entries. */}
              {days[index].isEmpty ? null : (
                <span
                  className={value > 0 ? "trend-fill" : "trend-fill is-zero"}
                  style={{ height: value > 0 ? `${Math.max(3, (value / scaleMax) * 100)}%` : "2px" }}
                />
              )}
            </div>
          ))}
          {/* The average is the reading that makes a bar mean something: a day
              is only "a lot" against the fortnight it sits in. It lives INSIDE
              the bars container for two load-bearing reasons. Percentages: an
              absolute child of .trend-plot resolves bottom:% against the
              padding box (108px) while the bars resolve height:% against the
              content box (98px) — two scales 10% apart, so a bar exactly on
              average drew visibly below the line and the line overstated every
              average. In here both resolve against the same box. Paint order:
              as a later sibling of the bars it paints over them, so today's
              opaque bar can no longer erase the "avg" label. */}
          {trackedDays > 0 && (
            <div className="trend-mean" style={{ bottom: `${(average / scaleMax) * 100}%` }}>
              <span>avg</span>
            </div>
          )}
        </div>
      </div>

      <div className="trend-axis" aria-hidden="true">
        <span>{dayFormat.format(days[0].date)}</span>
        <span>Today</span>
      </div>
    </section>
  );
}
