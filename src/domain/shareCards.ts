// The cards a parent shares. Pure: what goes on the picture, never how it is
// drawn (that is lib/shareCard.ts, which needs a canvas). Every card is a
// moment of joy or a fact worth handing on — a month-birthday, a week of
// feeds and sleep, the numbers for the paediatrician — and every one of
// them carries the app's name to a family group chat somewhere, which is
// how a private app with no ads gets found.

import { Milestone } from "./milestones";
import { UnitSystem, formatVolume, weightParts } from "./units";
import { VisitSummary } from "./visitSummary";
import { Activity } from "./types";

export type CardStat = { value: string; label: string };

export type CardSpec = {
  /** Small caps above the headline: "This week · 26 Aug – 1 Sep". */
  eyebrow: string;
  headline: string;
  sub?: string;
  /** Up to four figures, two to a row. */
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

export function milestoneCard(milestone: Milestone, now: number): CardSpec {
  return {
    eyebrow: longFormat.format(new Date(now)),
    headline: milestone.title,
    sub: milestone.sub,
  };
}

function hours(minutes: number): string {
  const whole = Math.round(minutes / 60);
  return `${whole}h`;
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
