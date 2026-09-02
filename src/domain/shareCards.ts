// The cards a parent shares. Pure: what goes on the picture, never how it is
// drawn (that is lib/shareCard.ts, which needs a canvas). Every card is a
// moment of joy or a fact worth handing on — a month-birthday, a week of
// feeds and sleep, the numbers for the paediatrician — and every one of
// them carries the app's name to a family group chat somewhere, which is
// how a private app with no ads gets found.

import { DaySummary } from "./daySummary";
import { Milestone } from "./milestones";
import { NightSummary } from "./nightSummary";
import { RhythmRecord } from "./rhythm";
import { formatTime, humanDuration } from "./time";
import { UnitSystem, formatVolume, weightParts } from "./units";
import { VisitSummary } from "./visitSummary";
import { LifetimeTotals } from "./lifetime";
import { Activity } from "./types";

export type { LifetimeTotals };

export type CardStat = { value: string; label: string };

export type CardSpec = {
  /** Small caps above the headline: "This week · 26 Aug – 1 Sep". */
  eyebrow: string;
  headline: string;
  sub?: string;
  /** Up to six figures, two to a row. */
  stats?: CardStat[];
  /** A quiet line above the footer. */
  footnote?: string;
};

export type WeekDay = {
  date: Date;
  feeds: Activity[];
  ml: number;
  diapers: number;
  /** Minutes. */
  sleep: number;
};

const dayFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "short" });
const longFormat = new Intl.DateTimeFormat("en", { weekday: "long", day: "numeric", month: "long" });

function possessive(name: string): string {
  const who = name.trim() || "Baby";
  return who.endsWith("s") ? `${who}’` : `${who}’s`;
}

function hours(minutes: number): string {
  const whole = Math.round(minutes / 60);
  return `${whole}h`;
}

/** A lifetime of milk reads better in litres once it passes ten of them. */
function bigVolume(ml: number, units: UnitSystem): string {
  if (units === "metric" && ml >= 10_000) return `${(ml / 1_000).toFixed(1)} L`;
  return formatVolume(ml, units);
}

/**
 * The month-birthday card. With a log behind it, it also says what the
 * family has done since day one — the "we changed 312 nappies" line that
 * gets a card forwarded past the grandparents.
 */
export function milestoneCard(milestone: Milestone, now: number, totals: LifetimeTotals | null = null, units: UnitSystem = "metric"): CardSpec {
  const stats: CardStat[] = [];
  if (totals) {
    if (totals.feeds > 0) stats.push({ value: String(totals.feeds), label: totals.feeds === 1 ? "feed" : "feeds" });
    if (totals.nappies > 0) stats.push({ value: String(totals.nappies), label: totals.nappies === 1 ? "nappy" : "nappies" });
    if (totals.sleepMinutes >= 60) stats.push({ value: hours(totals.sleepMinutes), label: "asleep" });
    if (totals.ml > 0) stats.push({ value: bigVolume(totals.ml, units), label: "of milk" });
  }
  return {
    eyebrow: longFormat.format(new Date(now)),
    headline: milestone.title,
    sub: milestone.sub,
    stats: stats.length ? stats : undefined,
    footnote: stats.length ? "All of it since day one, logged by hand — usually at 3am." : undefined,
  };
}

const weekdayFormat = new Intl.DateTimeFormat("en", { weekday: "long" });

/**
 * One day as a picture — "how did Tuesday go" for the parent who was at
 * work, or the grandmother who asks every evening.
 */
export function dayCard(name: string, summary: DaySummary, units: UnitSystem): CardSpec {
  const weekday = weekdayFormat.format(summary.date);
  const stats: CardStat[] = [];
  if (summary.feeds > 0) stats.push({ value: String(summary.feeds), label: summary.feeds === 1 ? "feed" : "feeds" });
  if (summary.bottles === 0 && summary.nursingMinutes > 0) {
    stats.push({ value: humanDuration(summary.nursingMinutes), label: "nursed" });
  } else if (summary.ml > 0) {
    stats.push({ value: formatVolume(summary.ml, units), label: "of milk" });
  }
  if (summary.diapers > 0) {
    stats.push({ value: String(summary.wet), label: "wet" });
    stats.push({ value: String(summary.dirty), label: "dirty" });
  }
  if (summary.sleepMinutes > 0) stats.push({ value: humanDuration(summary.sleepMinutes), label: "asleep" });
  if (summary.naps > 1 && summary.longestSleepMinutes > 0) {
    stats.push({ value: humanDuration(summary.longestSleepMinutes), label: "longest sleep" });
  }
  const bracket =
    summary.firstFeedAt && summary.lastFeedAt && summary.firstFeedAt !== summary.lastFeedAt
      ? `Feeds from ${formatTime(summary.firstFeedAt)} to ${formatTime(summary.lastFeedAt)}.`
      : undefined;
  return {
    eyebrow: summary.isToday ? `Today so far · ${longFormat.format(summary.date)}` : longFormat.format(summary.date),
    headline: `${possessive(name)} ${weekday}`,
    sub: bracket,
    stats: stats.slice(0, 6),
  };
}

export function weekCard(name: string, weekly: WeekDay[], units: UnitSystem): CardSpec {
  const feeds = weekly.reduce((sum, day) => sum + day.feeds.length, 0);
  const diapers = weekly.reduce((sum, day) => sum + day.diapers, 0);
  const sleepMinutes = weekly.reduce((sum, day) => sum + day.sleep, 0);
  const ml = weekly.reduce((sum, day) => sum + day.ml, 0);
  const logged = weekly.filter((day) => day.feeds.length > 0 || day.diapers > 0 || day.sleep > 0).length;
  const first = weekly[0]?.date;
  const last = weekly[weekly.length - 1]?.date;
  const stats: CardStat[] = [
    { value: String(feeds), label: feeds === 1 ? "feed" : "feeds" },
    { value: String(diapers), label: diapers === 1 ? "nappy" : "nappies" },
  ];
  if (sleepMinutes > 0) stats.push({ value: hours(sleepMinutes), label: "asleep" });
  if (ml > 0) stats.push({ value: formatVolume(ml, units), label: "of milk" });
  return {
    eyebrow: first && last ? `This week · ${dayFormat.format(first)} – ${dayFormat.format(last)}` : "This week",
    headline: `${possessive(name)} week`,
    sub: logged === weekly.length ? "Every day logged." : `${logged} of ${weekly.length} days logged.`,
    stats,
  };
}

const show = (value: number | null, digits = 0) => (value === null ? "—" : value.toFixed(digits));

export function visitCard(summary: VisitSummary, name: string, age: string | null, units: UnitSystem): CardSpec {
  const who = name.trim() || "Baby";
  const first = summary.days[0]?.date;
  const last = summary.days[summary.days.length - 1]?.date;
  const stats: CardStat[] = [
    { value: show(summary.feedsPerDay), label: "feeds a day" },
    { value: summary.mlPerDay === null ? "—" : formatVolume(summary.mlPerDay, units), label: "milk a day" },
    { value: show(summary.wetPerDay), label: "wet a day" },
    { value: show(summary.dirtyPerDay), label: "dirty a day" },
  ];
  if (summary.latestWeightGrams) {
    const weight = weightParts(summary.latestWeightGrams, units);
    stats.push({ value: `${weight.value} ${weight.unit}`, label: "latest weight" });
  }
  if (summary.gramsPerWeek !== null) stats.push({ value: `${summary.gramsPerWeek} g`, label: "gained a week" });
  return {
    eyebrow: "For the paediatrician",
    headline: age ? `${who}, ${age} old` : who,
    sub: first && last ? `${dayFormat.format(first)} – ${dayFormat.format(last)} · ${summary.loggedDays} of ${summary.days.length} days logged` : undefined,
    stats: stats.slice(0, 6),
    footnote: "Recorded at home by a parent, not a clinical measurement.",
  };
}

/**
 * The night, for the person who slept through it and the grandmother who
 * asks every morning. The one message a parent is actually asked for.
 */
export function nightCard(name: string, night: NightSummary): CardSpec {
  const stats: CardStat[] = [];
  if (night.sleepMinutes > 0) {
    stats.push({ value: humanDuration(night.sleepMinutes), label: "asleep" });
    stats.push({ value: humanDuration(night.longestStretchMinutes), label: "longest stretch" });
  }
  if (night.wakeUps > 0) stats.push({ value: String(night.wakeUps), label: night.wakeUps === 1 ? "waking" : "wakings" });
  if (night.feeds > 0) stats.push({ value: String(night.feeds), label: night.feeds === 1 ? "night feed" : "night feeds" });
  return {
    eyebrow: `Last night · ${longFormat.format(night.from)}`,
    headline: `${possessive(name)} night`,
    sub: night.firstFeedAt ? `First feed at ${formatTime(night.firstFeedAt)}.` : undefined,
    stats: stats.slice(0, 4),
  };
}

/**
 * The app calling it right. This is the card built for one moment: the
 * parent who has just watched a prediction land and wants to show somebody.
 */
export function rhythmCard(name: string, record: RhythmRecord): CardSpec {
  const who = name.trim() || "our baby";
  const stats: CardStat[] = [
    { value: `${record.hits}/${record.checked}`, label: "calls right" },
    { value: record.typicalMiss === 0 ? "spot on" : `${record.typicalMiss} min`, label: "typical miss" },
  ];
  return {
    eyebrow: record.kind === "sleep" ? "It knew when the next sleep was coming" : "It knew when the next feed was coming",
    headline: `Numalog called ${who}’s last ${record.checked} ${record.kind === "sleep" ? "sleeps" : "feeds"}`,
    sub: "Learned from our own log — no account, nothing sent anywhere.",
    stats,
    footnote: "It works out the rhythm from what you have already logged.",
  };
}
