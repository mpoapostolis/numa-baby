// Daily totals as a line: how much milk, how many feeds, how many wet or
// dirty nappies, one point per day. The question it answers is "is this week
// like last week", which a single day's numbers can never show.
//
// Deliberately not a judgement: no target line, no green/red, no "goal". The
// only emphasised point is today, because that is where the parent is.
import { currentLocale, t } from "../i18n";

import { useState } from "react";
import { track } from "../domain/analytics";
import { humanDuration } from "../domain/time";
import { mlToOz, useUnits } from "../domain/units";
import { DaySummary, hasRoutineCare } from "../domain/daySummary";

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

// The series a parent picked stays picked, on Today and on Insights alike:
// "which category I want to track" is a standing choice, not a tap to repeat
// on every visit. Local to the phone, and a courtesy — storage that refuses
// just means Milk again.
const SERIES_KEY = "numalog-trend-series-v1";

function rememberedSeries(): string {
  try {
    const stored = window.localStorage.getItem(SERIES_KEY);
    return SERIES.some((s) => s.key === stored) ? stored! : SERIES[0].key;
  } catch {
    return SERIES[0].key;
  }
}

function rememberSeries(key: string) {
  try {
    window.localStorage.setItem(SERIES_KEY, key);
  } catch {
    // Remembering is a courtesy.
  }
}

// Lazy, like every formatter in this app: the locale is settled before the
// first render, but not before this module's body runs.
let dayFormatter: Intl.DateTimeFormat | null = null;
let fullDayFormatter: Intl.DateTimeFormat | null = null;
let pickedDayFormatter: Intl.DateTimeFormat | null = null;
const dayFormat = () => (dayFormatter ??= new Intl.DateTimeFormat(currentLocale(), { weekday: "short" }));
const fullDayFormat = () => (fullDayFormatter ??= new Intl.DateTimeFormat(currentLocale(), { month: "short", day: "numeric" }));
const pickedDayFormat = () => (pickedDayFormatter ??= new Intl.DateTimeFormat(currentLocale(), { weekday: "short", month: "short", day: "numeric" }));

// Geometry in percentages, laid out with CSS rather than a stretched viewBox.
// The old chart used preserveAspectRatio="none", which distorted every slope
// with the card width — a line whose angle depends on the window is a chart
// that lies. Bars have no slope to distort.
const BAR_HEIGHT = 108;

/** A bar drawn from several days — Insights' weeks and months — as their
    average day: the days, its name, and the words that follow its figure
    or stand in for it. Today's chart passes none: a bar per day. */
export type TrendGroup = { at: number; days: DaySummary[]; label: string; reading?: string; empty?: string };

export function TrendChart({ days: allDays, groups, title }: {
  days: DaySummary[];
  groups?: (days: DaySummary[]) => TrendGroup[];
  title?: string;
}) {
  const [activeKey, setActiveKey] = useState(rememberedSeries);
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
  // record starts. "Logged" means feeds, nappies or sleep — the same rule as
  // the visit summary: a day holding only a weigh-in or a solids entry says
  // nothing about milk or nappies, and its zeros are not zeros.
  const firstLogged = allDays.findIndex(hasRoutineCare);
  const days = firstLogged <= 0 ? allDays : allDays.slice(firstLogged);

  const bars: Array<Partial<TrendGroup> & { at: number; days: DaySummary[] }> = groups
    ? groups(days)
    : days.map((day) => ({ at: day.date.getTime(), days: [day] }));
  // A group's figure is its average logged day, by the rule of the average
  // below; a day's is the day's own.
  const barValue = (barDays: DaySummary[]) => {
    if (barDays.length === 1) return series.value(barDays[0]);
    const logged = barDays.filter(hasRoutineCare);
    const complete = logged.filter((day) => !day.isToday);
    const counted = complete.length > 0 ? complete : logged;
    if (counted.length === 0) return 0;
    const mean = counted.reduce((sum, day) => sum + series.value(day), 0) / counted.length;
    return series.unit ? Math.round(mean) : Math.round(mean * 10) / 10;
  };
  const values = bars.map((bar) => barValue(bar.days));
  // Headroom so the tallest bar never touches the average label above it.
  const peak = Math.max(...values, 0);
  // Headroom so the tallest bar never collides with the average label.
  const scaleMax = Math.max(peak, 1) * 1.15;
  const todayIndex = bars.length - 1;
  // Averaged over the days that were LOGGED, not the days that happened to be
  // non-zero. A day with feeds but no dirty nappy is a real zero and belongs
  // in the denominator; leaving it out quietly inflates every average.
  const loggedDays = days.filter(hasRoutineCare);
  // Today is half-lived: its morning averaged in as a whole day pulls every
  // average down. It counts only while it is the only day there is.
  const completeDays = loggedDays.filter((day) => !day.isToday);
  const averaged = completeDays.length > 0 ? completeDays : loggedDays;
  const total = averaged.reduce((sum, day) => sum + series.value(day), 0);
  const trackedDays = averaged.length;
  const average = trackedDays > 0 ? Math.round(total / trackedDays) : 0;

  // Which day the readout is about, if any. Asked for from the feedback box:
  // each bar's total used to live in a title tooltip, which a mouse can
  // summon and a phone never shows — so on a phone the chart said only the
  // average. A tap pins a day (tap it again to let go); a mouse only has to
  // hover. Held by date rather than position, so the day stays chosen when
  // the category changes: "and how many wet nappies that day?" is the next
  // question.
  const [pinned, setPinned] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const shownAt = hovered ?? pinned;
  const shownIndex = shownAt === null ? -1 : bars.findIndex((bar) => bar.at === shownAt);
  const shownBar = shownIndex >= 0 ? bars[shownIndex] : null;
  const shown = shownBar?.days[0] ?? null;
  const shownLogged = shownBar ? shownBar.days.some(hasRoutineCare) : false;
  const withUnit = (value: number) => `${fmt(value)}${unitLabel ? ` ${unitLabel}` : ""}`;

  return (
    <section className="trend-card" aria-label={t("{what} over the last {n} days", { what: t(series.label), n: days.length })}>
      <header className="trend-head">
        <div className="trend-titles">
          <span className="t-label">{title ?? t("Last {n} days", { n: days.length })}</span>
          <p className="trend-average" aria-live="polite">
            {shownBar && shown ? (
              !shownLogged ? (
                <span>{shownBar.empty ?? t("No feeds, nappies or sleep logged on {day}", { day: pickedDayFormat().format(shown.date) })}</span>
              ) : (
                <>
                  <strong className="figure">{fmt(values[shownIndex])}{unitLabel && <span className="unit">{unitLabel}</span>}</strong>
                  <span> {shownBar.reading ?? (shown.isToday ? t("so far today") : t("on {day}", { day: pickedDayFormat().format(shown.date) }))}</span>
                </>
              )
            ) : trackedDays > 0 ? (
              <>
                <strong className="figure">{fmt(average)}{unitLabel && <span className="unit">{unitLabel}</span>}</strong>
                <span> {t("a day on average")}</span>
              </>
            ) : (
              <span>{t("Nothing logged yet")}</span>
            )}
          </p>
        </div>
        {trackedDays > 0 && (
          <span className="trend-peak">
            {t("peak")} {fmt(peak)}{unitLabel && <span className="unit">{unitLabel}</span>}
          </span>
        )}
      </header>

      {/* Plain toggle buttons, not the ARIA tabs pattern: tabs promise
          arrow-key navigation and panels this chart does not have. */}
      <div className="trend-tabs" role="group" aria-label={t("Choose what to chart")}>
        {SERIES.map((option) => (
          <button
            key={option.key}
            type="button"
            aria-pressed={option.key === activeKey}
            className={option.key === activeKey ? "trend-tab is-active" : "trend-tab"}
            style={{ "--trend-hue": option.hue } as React.CSSProperties}
            onClick={() => {
              track("trend_series_changed", { series: option.key });
              setActiveKey(option.key);
              rememberSeries(option.key);
            }}
          >
            {t(option.label)}
          </button>
        ))}
      </div>

      <div
        className="trend-plot"
        style={{ "--trend-hue": series.hue, height: `${BAR_HEIGHT}px` } as React.CSSProperties}
        role="group"
        aria-label={t("{what} per day — tap a day for its total", { what: t(series.label) })}
      >
        <div className="trend-bars">
          {values.map((value, index) => {
            const { at, label = fullDayFormat().format(bars[index].days[0].date) } = bars[index];
            const logged = bars[index].days.some(hasRoutineCare);
            return (
            <button
              type="button"
              className={`trend-bar${index === todayIndex ? " is-today" : ""}${index === shownIndex ? " is-picked" : ""}`}
              key={at}
              aria-label={logged
                ? `${label}: ${withUnit(value)}`
                : t("{day}: not logged", { day: label })}
              aria-pressed={pinned === at}
              onClick={() => {
                if (pinned !== at) track("trend_day_picked", { series: series.key });
                setPinned((current) => (current === at ? null : at));
              }}
              onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(at); }}
              onPointerLeave={(event) => { if (event.pointerType === "mouse") setHovered(null); }}
            >
              {/* Three distinct states, because a day nobody logged is not a
                  day with none: a bar, a hairline for a logged zero, and
                  nothing at all for a day with no feeds, nappies or sleep. */}
              {!logged ? null : (
                <span
                  className={value > 0 ? "trend-fill" : "trend-fill is-zero"}
                  style={{ height: value > 0 ? `${Math.max(3, (value / scaleMax) * 100)}%` : "2px" }}
                />
              )}
            </button>
            );
          })}
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
              <span>{t("avg")}</span>
            </div>
          )}
        </div>
      </div>

      <div className="trend-axis" aria-hidden="true">
        <span>{bars[0].label ?? dayFormat().format(days[0].date)}</span>
        <span>{t("Today")}</span>
      </div>
    </section>
  );
}
