// The day's numbers, in the order a parent (or their paediatrician) asks for
// them: how much milk, how many wet, how many dirty, how much sleep. One
// component serves both readings — the full card on Today ("Today so far")
// and a single compact line under each Timeline day heading, so scrolling
// back through the week answers "how did Tuesday go" without opening anything.
//
// Every figure comes from summarizeDay, so the two readings can never disagree.

import { ChevronLeft, ChevronRight, Share2 } from "lucide-react";
import { ActivityGlyph } from "./ActivityGlyph";
import { track } from "../domain/analytics";
import { Button } from "./ui/button";
import { t } from "../i18n";
import { DaySummary } from "../domain/daySummary";
import { shareLink } from "../domain/shareApp";
import { formatTime, humanDuration } from "../domain/time";
import { formatVolume, useUnits, volumeParts } from "../domain/units";
import { shareCardOnTap } from "../lib/shareOnTap";

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
  glyph: "bottle" | "nursing" | "diaper" | "sleep";
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
// "3 stretches · longest 2h 30m" — the shape of the night, not just its total.
function sleepSub(summary: DaySummary) {
  const parts: string[] = [];
  if (summary.naps > 0) parts.push(summary.naps === 1 ? t("1 stretch") : t("{n} stretches", { n: summary.naps }));
  if (summary.longestSleepMinutes > 0) parts.push(t("longest {duration}", { duration: humanDuration(summary.longestSleepMinutes) }));
  return parts.join(" · ") || undefined;
}

function changesSub(summary: DaySummary) {
  if (summary.diapers === 0) return undefined;
  return summary.diapers === 1 ? t("of 1 change") : t("of {n} changes", { n: summary.diapers });
}

function feedSub(summary: DaySummary) {
  const parts: string[] = [];
  if (summary.bottles > 0) parts.push(summary.bottles === 1 ? t("1 bottle") : t("{n} bottles", { n: summary.bottles }));
  if (summary.nursings > 0) parts.push(t("{n} nursing", { n: summary.nursings }));
  return parts.join(" · ");
}

// The millilitre figure covers bottles only; say so whenever the day also
// held nursing, so the number is never read as the day's total intake.
function milkSub(summary: DaySummary) {
  if (summary.nursings === 0) return undefined;
  return summary.nursingMinutes > 0
    ? t("bottles only · {duration} nursing", { duration: humanDuration(summary.nursingMinutes) })
    : t("bottles only");
}

function nursedSub(summary: DaySummary) {
  const sessions = summary.nursings === 1 ? t("1 session") : t("{n} sessions", { n: summary.nursings });
  return summary.hasRunningTimer ? t("{sessions} · one still going", { sessions }) : sessions;
}

type DayRecapProps = {
  summary: DaySummary;
  title: string;
  /** The baby's name, for the picture this day can become. */
  name?: string;
  /** Omitted entirely when there is no history to walk; otherwise both arrows
      always render and disable at the ends, so the header never reflows. */
  stepper?: {
    onPrev: () => void;
    onNext: () => void;
    canPrev: boolean;
    canNext: boolean;
  };
};

export function DayRecap({ summary, title, name = "", stepper }: DayRecapProps) {
  const units = useUnits();
  // The day as one picture — "how did Tuesday go" for the parent at work
  // and the grandmother who asks every evening, in any language.
  // Local date for the file name: toISOString would name a Greek evening's
  // picture after the day before.
  const dayKey = `${summary.date.getFullYear()}-${String(summary.date.getMonth() + 1).padStart(2, "0")}-${String(summary.date.getDate()).padStart(2, "0")}`;
  function share() {
    track("day_shared", { today: summary.isToday });
    void shareCardOnTap(
      (cards) => cards.dayCard(name, summary, units),
      `numalog-${dayKey}.png`,
      `${name.trim() || t("Baby")} · ${title.toLowerCase()} · ${shareLink("day")}`,
    );
  }
  const milk = volumeParts(summary.ml, units);
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
            aria-label={t("Previous day")}
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </Button>
        )}
        <span className="t-label recap-title">{title}</span>
        {bracket && <span className="recap-bracket">{bracket}</span>}
        {!summary.isEmpty && (
          <Button
            variant="ghost"
            className="recap-step recap-share"
            onClick={share}
            aria-label={t("Share {what} as a picture", { what: title.toLowerCase() })}
          >
            <Share2 size={16} aria-hidden="true" />
          </Button>
        )}
        {stepper && (
          <Button
            variant="ghost"
            className="recap-step"
            onClick={() => { track("recap_day_stepped", { direction: "forward" }); stepper.onNext(); }}
            disabled={!stepper.canNext}
            aria-label={t("Next day")}
          >
            <ChevronRight size={16} aria-hidden="true" />
          </Button>
        )}
      </header>
      {summary.isEmpty ? (
        <p className="recap-empty">
          {summary.isToday ? t("Nothing logged yet today.") : t("Nothing logged on this day.")}
        </p>
      ) : (
      <div className="recap-grid">
        <Stat
          glyph="nursing"
          label={summary.feeds === 1 ? t("Feed") : t("Feeds")}
          sub={feedSub(summary)}
        >
          <Count value={summary.feeds} />
        </Stat>
        {/* A breast-only day gets time at the breast, not "Milk —" forever.
            When both happen, the millilitres are labelled as bottles only —
            300 ml is not the day's whole intake if there was also nursing. */}
        {summary.bottles === 0 && summary.nursings > 0 ? (
          <Stat glyph="nursing" label={t("Nursed")} sub={nursedSub(summary)}>
            <Duration minutes={summary.nursingMinutes} />
          </Stat>
        ) : (
          <Stat glyph="bottle" label={t("Milk")} sub={milkSub(summary)}>
            {summary.ml > 0
              ? <>{milk.value}<span className="unit">{milk.unit}</span></>
              : <span className="is-zero">—</span>}
          </Stat>
        )}
        <Stat glyph="diaper" label={t("Wet")} sub={changesSub(summary)}>
          <Count value={summary.wet} />
        </Stat>
        <Stat glyph="diaper" label={t("Dirty")} sub={changesSub(summary)}>
          <Count value={summary.dirty} />
        </Stat>
        <Stat glyph="sleep" label={t("Sleep")} sub={sleepSub(summary)}>
          <Duration minutes={summary.sleepMinutes} />
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
  const units = useUnits();
  const parts: string[] = [];
  // Each part is its own small sentence, so Greek can put the number where it
  // belongs — "4 τσίσα", not a count glued to a translated noun.
  if (summary.feeds > 0) parts.push(summary.feeds === 1 ? t("1 feed") : t("{n} feeds", { n: summary.feeds }));
  if (summary.ml > 0) parts.push(formatVolume(summary.ml, units));
  if (summary.wet > 0) parts.push(t("{n} wet", { n: summary.wet }));
  if (summary.dirty > 0) parts.push(t("{n} dirty", { n: summary.dirty }));
  if (summary.sleepMinutes > 0) parts.push(t("{duration} sleep", { duration: humanDuration(summary.sleepMinutes) }));
  if (summary.solids > 0) parts.push(summary.solids === 1 ? t("1 solid") : t("{n} solids", { n: summary.solids }));
  if (parts.length === 0) return null;
  return <p className="recap-line">{parts.join(" · ")}</p>;
}
