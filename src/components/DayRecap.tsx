// The day's numbers, in the order a parent (or their paediatrician) asks for
// them: how much milk, how many wet, how many dirty, how much sleep. One
// component serves both readings — the full card on Today ("Today so far")
// and a single compact line under each Timeline day heading, so scrolling
// back through the week answers "how did Tuesday go" without opening anything.
//
// Every figure comes from summarizeDay, so the two readings can never disagree.

import { ChevronLeft, ChevronRight } from "lucide-react";
import { ActivityGlyph } from "./ActivityGlyph";
import { track } from "../domain/analytics";
import { Button } from "./ui/button";
import { DaySummary } from "../domain/daySummary";
import { formatTime, humanDuration } from "../domain/time";

// Unit demotion, the house rule: digits speak, units recede.
function Duration({ minutes }: { minutes: number }) {
  if (minutes <= 0) return <span className="is-zero">—</span>;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return <>{mins}<span className="unit">m</span></>;
  if (mins === 0) return <>{hours}<span className="unit">h</span></>;
  return <>{hours}<span className="unit">h</span> {mins}<span className="unit">m</span></>;
}

function Count({ value }: { value: number }) {
  if (value <= 0) return <span className="is-zero">—</span>;
  return <>{value}</>;
}

type StatProps = {
  glyph: "bottle" | "nursing" | "diaper";
  label: string;
  children: React.ReactNode;
  sub?: string;
};

function Stat({ glyph, label, children, sub }: StatProps) {
  return (
    <div className="recap-stat">
      <span className={`activity-glyph glyph-${glyph}`} aria-hidden="true">
        <ActivityGlyph type={glyph} />
      </span>
      <div className="recap-figures">
        <span className="figure t-numeral recap-value">{children}</span>
        <span className="recap-label">{label}</span>
        {/* The secondary line is where the breakdown lives — present only when
            there is something to break down, never a placeholder. */}
        {sub && <span className="recap-sub">{sub}</span>}
      </div>
    </div>
  );
}

// Wet and dirty each get their own numeral, so "how many times did she pee"
// is answered at glance speed. They deliberately overlap — a "both" change
// counts in each — so the reconciling line names the real change count.
function changesSub(summary: DaySummary) {
  if (summary.diapers === 0) return undefined;
  return `of ${summary.diapers} ${summary.diapers === 1 ? "change" : "changes"}`;
}

function feedSub(summary: DaySummary) {
  const parts: string[] = [];
  if (summary.bottles > 0) parts.push(`${summary.bottles} bottle${summary.bottles === 1 ? "" : "s"}`);
  if (summary.nursings > 0) parts.push(`${summary.nursings} nursing`);
  return parts.join(" · ");
}

// The millilitre figure covers bottles only; say so whenever the day also
// held nursing, so the number is never read as the day's total intake.
function milkSub(summary: DaySummary) {
  if (summary.nursings === 0) return undefined;
  return summary.nursingMinutes > 0
    ? `bottles only · ${humanDuration(summary.nursingMinutes)} nursing`
    : "bottles only";
}

function nursedSub(summary: DaySummary) {
  const sessions = `${summary.nursings} ${summary.nursings === 1 ? "session" : "sessions"}`;
  return summary.hasRunningTimer ? `${sessions} · one still going` : sessions;
}

type DayRecapProps = {
  summary: DaySummary;
  title: string;
  /** Omitted entirely when there is no history to walk; otherwise both arrows
      always render and disable at the ends, so the header never reflows. */
  stepper?: {
    onPrev: () => void;
    onNext: () => void;
    canPrev: boolean;
    canNext: boolean;
  };
};

export function DayRecap({ summary, title, stepper }: DayRecapProps) {
  const bracket =
    summary.firstFeedAt && summary.lastFeedAt && summary.firstFeedAt !== summary.lastFeedAt
      ? `${formatTime(summary.firstFeedAt)} → ${formatTime(summary.lastFeedAt)}`
      : null;

  return (
    <section className="day-recap" aria-label={`${title} summary`}>
      <header className="recap-head">
        {/* The stepper walks whole calendar days: back only as far as the
            first thing ever logged, forward never past today. */}
        {stepper && (
          <Button
            variant="ghost"
            className="recap-step"
            onClick={() => { track("recap_day_stepped", { direction: "back" }); stepper.onPrev(); }}
            disabled={!stepper.canPrev}
            aria-label="Previous day"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </Button>
        )}
        <span className="t-label recap-title">{title}</span>
        {bracket && <span className="recap-bracket">{bracket}</span>}
        {stepper && (
          <Button
            variant="ghost"
            className="recap-step"
            onClick={() => { track("recap_day_stepped", { direction: "forward" }); stepper.onNext(); }}
            disabled={!stepper.canNext}
            aria-label="Next day"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </Button>
        )}
      </header>
      {summary.isEmpty ? (
        <p className="recap-empty">
          {summary.isToday ? "Nothing logged yet today." : "Nothing logged on this day."}
        </p>
      ) : (
      <div className="recap-grid">
        <Stat
          glyph="nursing"
          label={summary.feeds === 1 ? "Feed" : "Feeds"}
          sub={feedSub(summary)}
        >
          <Count value={summary.feeds} />
        </Stat>
        {/* A breast-only day gets time at the breast, not "Milk —" forever.
            When both happen, the millilitres are labelled as bottles only —
            300 ml is not the day's whole intake if there was also nursing. */}
        {summary.bottles === 0 && summary.nursings > 0 ? (
          <Stat glyph="nursing" label="Nursed" sub={nursedSub(summary)}>
            <Duration minutes={summary.nursingMinutes} />
          </Stat>
        ) : (
          <Stat glyph="bottle" label="Milk" sub={milkSub(summary)}>
            {summary.ml > 0
              ? <>{summary.ml}<span className="unit">ml</span></>
              : <span className="is-zero">—</span>}
          </Stat>
        )}
        <Stat glyph="diaper" label="Wet" sub={changesSub(summary)}>
          <Count value={summary.wet} />
        </Stat>
        <Stat glyph="diaper" label="Dirty" sub={changesSub(summary)}>
          <Count value={summary.dirty} />
        </Stat>
      </div>
      )}
    </section>
  );
}

/**
 * The same day as one line, for a Timeline day heading. Only the parts that
 * happened appear — an empty day renders nothing at all.
 */
export function DayRecapLine({ summary }: { summary: DaySummary }) {
  const parts: string[] = [];
  if (summary.feeds > 0) parts.push(`${summary.feeds} ${summary.feeds === 1 ? "feed" : "feeds"}`);
  if (summary.ml > 0) parts.push(`${summary.ml} ml`);
  if (summary.wet > 0) parts.push(`${summary.wet} wet`);
  if (summary.dirty > 0) parts.push(`${summary.dirty} dirty`);
  if (parts.length === 0) return null;
  return <p className="recap-line">{parts.join(" · ")}</p>;
}
