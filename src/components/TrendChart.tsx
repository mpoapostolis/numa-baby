// Daily totals as a line: how much milk, how many feeds, how many wet or
// dirty nappies, one point per day. The question it answers is "is this week
// like last week", which a single day's numbers can never show.
//
// Deliberately not a judgement: no target line, no green/red, no "goal". The
// only emphasised point is today, because that is where the parent is.

import { useState } from "react";
import { DaySummary } from "../domain/daySummary";

type Series = {
  key: string;
  label: string;
  glyph: "bottle" | "nursing" | "diaper";
  hue: string;
  unit?: string;
  value: (day: DaySummary) => number;
};

const SERIES: Series[] = [
  { key: "ml", label: "Milk", glyph: "bottle", hue: "var(--glyph-bottle)", unit: "ml", value: (d) => d.ml },
  { key: "feeds", label: "Feeds", glyph: "nursing", hue: "var(--glyph-nursing)", value: (d) => d.feeds },
  { key: "wet", label: "Wet", glyph: "diaper", hue: "var(--glyph-diaper)", value: (d) => d.wet },
  { key: "dirty", label: "Dirty", glyph: "diaper", hue: "var(--glyph-growth)", value: (d) => d.dirty },
];

const dayFormat = new Intl.DateTimeFormat("en", { weekday: "short" });
const fullDayFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });

// A fixed viewBox with the plot inset: the SVG scales to any card width while
// the stroke and dot sizes stay put.
const W = 300;
const H = 96;
const PAD_X = 6;
const PAD_TOP = 10;
const PAD_BOTTOM = 8;

export function TrendChart({ days: allDays }: { days: DaySummary[] }) {
  const [activeKey, setActiveKey] = useState(SERIES[0].key);
  const series = SERIES.find((s) => s.key === activeKey) ?? SERIES[0];

  // Days before anything was ever logged are not zero-milk days — they are
  // days this app was not being used. Plotting them as zero would draw a
  // cliff that reads as "she ate nothing", so the line starts where the
  // record starts.
  const firstLogged = allDays.findIndex((day) => !day.isEmpty);
  const days = firstLogged <= 0 ? allDays : allDays.slice(firstLogged);

  const values = days.map(series.value);
  const max = Math.max(...values, 1);
  const plotW = W - PAD_X * 2;
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const x = (index: number) =>
    days.length === 1 ? W / 2 : PAD_X + (index / (days.length - 1)) * plotW;
  const y = (value: number) => PAD_TOP + plotH - (value / max) * plotH;

  const points = values.map((value, index) => `${x(index)},${y(value)}`).join(" ");
  const area = `${PAD_X},${PAD_TOP + plotH} ${points} ${x(days.length - 1)},${PAD_TOP + plotH}`;
  const todayIndex = days.length - 1;
  const total = values.reduce((sum, value) => sum + value, 0);
  // Averaged over the days that actually have something, so a fortnight with
  // three tracked days does not read as "mostly zero".
  const trackedDays = values.filter((value) => value > 0).length;
  const average = trackedDays > 0 ? Math.round(total / trackedDays) : 0;

  const description = `${series.label} per day. ${days
    .map((day) => `${fullDayFormat.format(day.date)}: ${series.value(day)}${series.unit ? ` ${series.unit}` : ""}`)
    .join(", ")}.`;

  return (
    <section className="trend-card" aria-label={`${series.label} over the last ${days.length} days`}>
      <header className="trend-head">
        <div className="trend-titles">
          <span className="t-label">Last {days.length} days</span>
          <p className="trend-average">
            {trackedDays > 0 ? (
              <>
                <strong className="figure">{average}{series.unit && <span className="unit">{series.unit}</span>}</strong>
                <span> a day on average</span>
              </>
            ) : (
              <span>Nothing logged yet</span>
            )}
          </p>
        </div>
        {trackedDays > 0 && (
          <span className="trend-peak">
            peak {max}{series.unit && <span className="unit">{series.unit}</span>}
          </span>
        )}
      </header>

      <div className="trend-tabs" role="tablist" aria-label="Choose what to chart">
        {SERIES.map((option) => (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={option.key === activeKey}
            className={option.key === activeKey ? "trend-tab is-active" : "trend-tab"}
            style={{ "--trend-hue": option.hue } as React.CSSProperties}
            onClick={() => setActiveKey(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="trend-plot" style={{ "--trend-hue": series.hue } as React.CSSProperties}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={description}>
          <polygon className="trend-area" points={area} />
          <polyline className="trend-line" points={points} />
          {values.map((value, index) => (
            <circle
              key={days[index].date.toISOString()}
              className={index === todayIndex ? "trend-dot is-today" : "trend-dot"}
              cx={x(index)}
              cy={y(value)}
              r={index === todayIndex ? 3.5 : 2}
            >
              <title>
                {fullDayFormat.format(days[index].date)}: {value}
                {series.unit ? ` ${series.unit}` : ""}
              </title>
            </circle>
          ))}
        </svg>
      </div>

      <div className="trend-axis" aria-hidden="true">
        <span>{dayFormat.format(days[0].date)}</span>
        <span>Today</span>
      </div>
    </section>
  );
}
