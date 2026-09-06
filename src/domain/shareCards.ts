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
import { currentLocale, t, tAge } from "../i18n";

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

// Lazy, per-locale: a card is built when it is shared, long after the
// dictionary has loaded, and the picture must date itself in the language of
// the person sending it.
const dayFormat = () => new Intl.DateTimeFormat(currentLocale(), { day: "numeric", month: "short" });
const longFormat = () => new Intl.DateTimeFormat(currentLocale(), { weekday: "long", day: "numeric", month: "long" });

/** "Mia’s" — and in a language that does not mark possession this way, just
    "Mia". The headline sentences below put the name where their own grammar
    wants it, so this only has to hand back the right FORM of the name. */
function possessive(name: string): string {
  const who = name.trim() || t("Baby");
  if (currentLocale() !== "en") return who;
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
    if (totals.feeds > 0) stats.push({ value: String(totals.feeds), label: totals.feeds === 1 ? t("feed") : t("feeds") });
    if (totals.nappies > 0) stats.push({ value: String(totals.nappies), label: totals.nappies === 1 ? t("nappy") : t("nappies") });
    if (totals.sleepMinutes >= 60) stats.push({ value: hours(totals.sleepMinutes), label: t("asleep") });
    if (totals.ml > 0) stats.push({ value: bigVolume(totals.ml, units), label: t("of milk") });
  }
  return {
    eyebrow: longFormat().format(new Date(now)),
    headline: t(milestone.title, milestone.vars),
    sub: t(milestone.sub),
    stats: stats.length ? stats : undefined,
    footnote: stats.length ? t("All of it since day one, logged by hand — usually at 3am.") : undefined,
  };
}

const weekdayFormat = () => new Intl.DateTimeFormat(currentLocale(), { weekday: "long" });

/**
 * One day as a picture — "how did Tuesday go" for the parent who was at
 * work, or the grandmother who asks every evening.
 */
export function dayCard(name: string, summary: DaySummary, units: UnitSystem): CardSpec {
  const weekday = weekdayFormat().format(summary.date);
  const stats: CardStat[] = [];
  if (summary.feeds > 0) stats.push({ value: String(summary.feeds), label: summary.feeds === 1 ? t("feed") : t("feeds") });
  if (summary.bottles === 0 && summary.nursingMinutes > 0) {
    stats.push({ value: humanDuration(summary.nursingMinutes), label: t("nursed") });
  } else if (summary.ml > 0) {
    stats.push({ value: formatVolume(summary.ml, units), label: t("of milk") });
  }
  if (summary.diapers > 0) {
    stats.push({ value: String(summary.wet), label: t("wet") });
    stats.push({ value: String(summary.dirty), label: t("dirty") });
  }
  if (summary.sleepMinutes > 0) stats.push({ value: humanDuration(summary.sleepMinutes), label: t("asleep") });
  if (summary.naps > 1 && summary.longestSleepMinutes > 0) {
    stats.push({ value: humanDuration(summary.longestSleepMinutes), label: t("longest sleep") });
  }
  const bracket =
    summary.firstFeedAt && summary.lastFeedAt && summary.firstFeedAt !== summary.lastFeedAt
      ? t("Feeds from {first} to {last}.", { first: formatTime(summary.firstFeedAt), last: formatTime(summary.lastFeedAt) })
      : undefined;
  return {
    eyebrow: summary.isToday ? t("Today so far · {date}", { date: longFormat().format(summary.date) }) : longFormat().format(summary.date),
    headline: t("{who} {weekday}", { who: possessive(name), weekday }),
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
    { value: String(feeds), label: feeds === 1 ? t("feed") : t("feeds") },
    { value: String(diapers), label: diapers === 1 ? t("nappy") : t("nappies") },
  ];
  if (sleepMinutes > 0) stats.push({ value: hours(sleepMinutes), label: t("asleep") });
  if (ml > 0) stats.push({ value: formatVolume(ml, units), label: t("of milk") });
  return {
    eyebrow: first && last ? t("This week · {from} – {to}", { from: dayFormat().format(first), to: dayFormat().format(last) }) : t("This week"),
    headline: t("{who} week", { who: possessive(name) }),
    sub: logged === weekly.length ? t("Every day logged.") : t("{logged} of {total} days logged.", { logged, total: weekly.length }),
    stats,
  };
}

const show = (value: number | null, digits = 0) => (value === null ? "—" : value.toFixed(digits));

export function visitCard(summary: VisitSummary, name: string, age: string | null, units: UnitSystem): CardSpec {
  const who = name.trim() || t("Baby");
  const first = summary.days[0]?.date;
  const last = summary.days[summary.days.length - 1]?.date;
  const stats: CardStat[] = [
    { value: show(summary.feedsPerDay), label: t("feeds a day") },
    { value: summary.mlPerDay === null ? "—" : formatVolume(summary.mlPerDay, units), label: t("milk a day") },
    { value: show(summary.wetPerDay), label: t("wet a day") },
    { value: show(summary.dirtyPerDay), label: t("dirty a day") },
  ];
  if (summary.latestWeightGrams) {
    const weight = weightParts(summary.latestWeightGrams, units);
    stats.push({ value: `${weight.value} ${weight.unit}`, label: t("latest weight") });
  }
  if (summary.gramsPerWeek !== null) stats.push({ value: `${summary.gramsPerWeek} g`, label: t("gained a week") });
  return {
    eyebrow: t("For the paediatrician"),
    headline: age ? t("{name}, {age} old", { name: who, age: tAge(age) }) : who,
    sub: first && last
      ? t("{from} – {to} · {logged} of {total} days logged", { from: dayFormat().format(first), to: dayFormat().format(last), logged: summary.loggedDays, total: summary.days.length })
      : undefined,
    stats: stats.slice(0, 6),
    footnote: t("Recorded at home by a parent, not a clinical measurement."),
  };
}

/**
 * The night, for the person who slept through it and the grandmother who
 * asks every morning. The one message a parent is actually asked for.
 */
export function nightCard(name: string, night: NightSummary): CardSpec {
  const stats: CardStat[] = [];
  if (night.sleepMinutes > 0) {
    stats.push({ value: humanDuration(night.sleepMinutes), label: t("asleep") });
    stats.push({ value: humanDuration(night.longestStretchMinutes), label: t("longest stretch") });
  }
  if (night.wakeUps > 0) stats.push({ value: String(night.wakeUps), label: night.wakeUps === 1 ? t("waking") : t("wakings") });
  if (night.feeds > 0) stats.push({ value: String(night.feeds), label: night.feeds === 1 ? t("night feed") : t("night feeds") });
  return {
    eyebrow: t("Last night · {date}", { date: longFormat().format(night.from) }),
    headline: t("{who} night", { who: possessive(name) }),
    sub: night.firstFeedAt ? t("First feed at {time}.", { time: formatTime(night.firstFeedAt) }) : undefined,
    stats: stats.slice(0, 4),
  };
}

/**
 * The app calling it right. This is the card built for one moment: the
 * parent who has just watched a prediction land and wants to show somebody.
 */
export function rhythmCard(name: string, record: RhythmRecord): CardSpec {
  const who = name.trim() || t("our baby");
  const stats: CardStat[] = [
    { value: `${record.hits}/${record.checked}`, label: t("calls right") },
    { value: record.typicalMiss === 0 ? t("spot on") : t("{n} min", { n: record.typicalMiss }), label: t("typical miss") },
  ];
  return {
    eyebrow: record.kind === "sleep" ? t("It knew when the next sleep was coming") : t("It knew when the next feed was coming"),
    headline: record.kind === "sleep"
      ? t("Numalog called {who}’s last {n} sleeps", { who, n: record.checked })
      : t("Numalog called {who}’s last {n} feeds", { who, n: record.checked }),
    sub: t("Learned from our own log — no account, nothing sent anywhere."),
    stats,
    footnote: t("It works out the rhythm from what you have already logged."),
  };
}
