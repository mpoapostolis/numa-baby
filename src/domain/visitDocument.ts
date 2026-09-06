// The paediatrician summary as words: what goes on the sheet, the PDF page
// (lib/visitPdf.ts) and the picture, built once from the same VisitSummary
// so the three can never disagree.

import { hasRoutineCare } from "./daySummary";
import { UnitSystem, formatKg, formatVolume, volumeParts, weightParts } from "./units";
import { VisitSummary } from "./visitSummary";
import { currentLocale, t, tAge } from "../i18n";

export type VisitFigure = { value: string; unit?: string; label: string };
export type VisitSection = { heading: string; figures: VisitFigure[]; note: string };
export type VisitDay = { label: string; feeds: string; ml: string; wet: string; dirty: string; blank: boolean };

export type VisitDocument = {
  eyebrow: string;
  title: string;
  sub: string;
  coverage: string;
  sections: VisitSection[];
  volumeUnit: string;
  days: VisitDay[];
  footnote: string;
};

type Band = { p3: number; p50: number; p97: number } | null;
type Gain = { minGramsPerWeek: number; maxGramsPerWeek: number } | null;

// Lazy, per-locale: this builder runs at render/share time, after initLocale,
// and the same page must date itself in the reader's language.
const dayFormat = () => new Intl.DateTimeFormat(currentLocale(), { day: "numeric", month: "short" });
const longDate = () => new Intl.DateTimeFormat(currentLocale(), { day: "numeric", month: "long", year: "numeric" });

const show = (value: number | null, digits = 0) => (value === null ? "—" : value.toFixed(digits));

export function visitDocument(
  summary: VisitSummary,
  name: string,
  age: string | null,
  units: UnitSystem,
  band: Band,
  gain: Gain,
  now: number,
): VisitDocument {
  const who = name.trim() || t("Baby");
  const first = summary.days[0]?.date;
  const last = summary.days[summary.days.length - 1]?.date;
  const window = first && last ? `${dayFormat().format(first)} – ${dayFormat().format(last)}` : "";
  const weightUnit = weightParts(0, units).unit;
  const volumeUnit = volumeParts(0, units).unit;

  const feeding: VisitSection = {
    heading: t("Feeding"),
    figures: [
      { value: show(summary.feedsPerDay), label: t("feeds a day") },
      { value: summary.mlPerDay === null ? "—" : volumeParts(summary.mlPerDay, units).value, unit: volumeUnit, label: t("milk a day") },
      { value: show(summary.nursingMinutesPerDay), unit: "min", label: t("nursing a day") },
    ],
    note: t("{feeds} feeds and {vol} across the window. Bottle volumes are bottles only.", { feeds: summary.totalFeeds, vol: formatVolume(summary.totalMl, units) }),
  };
  const diapers: VisitSection = {
    heading: t("Nappies"),
    figures: [
      { value: show(summary.wetPerDay), label: t("wet a day") },
      { value: show(summary.dirtyPerDay), label: t("dirty a day") },
    ],
    note: t("{wet} wet and {dirty} dirty across the window. A change recorded as both counts in each.", { wet: summary.totalWet, dirty: summary.totalDirty }),
  };
  const growth: VisitSection = {
    heading: t("Growth"),
    figures: [
      { value: summary.latestWeightGrams ? weightParts(summary.latestWeightGrams, units).value : "—", unit: weightUnit, label: t("latest weight") },
      { value: summary.gramsPerWeek === null ? "—" : String(summary.gramsPerWeek), unit: "g", label: t("gained a week") },
    ],
    note: [
      band
        ? t("WHO reference at this age: {low}–{high} (P3–P97), midpoint {mid}.", { low: formatKg(band.p3, units), high: formatKg(band.p97, units), mid: formatKg(band.p50, units) })
        : t("No age on file, so no WHO reference is shown."),
      gain ? t("Typical gain {min}–{max} g a week.", { min: gain.minGramsPerWeek, max: gain.maxGramsPerWeek }) : "",
    ].filter(Boolean).join(" "),
  };

  return {
    eyebrow: t("For the paediatrician"),
    title: age ? t("{name}, {age} old", { name: who, age: tAge(age) }) : who,
    sub: [window, t("{n} days", { n: summary.days.length }), t("printed {date}", { date: longDate().format(new Date(now)) })].filter(Boolean).join(" · "),
    coverage: summary.blankDays > 0
      ? (summary.blankDays === 1
        ? t("{logged} of {total} days have entries. 1 day was not logged, so the daily figures are medians over the logged days only.", { logged: summary.loggedDays, total: summary.days.length })
        : t("{logged} of {total} days have entries. {blank} days were not logged, so the daily figures are medians over the logged days only.", { logged: summary.loggedDays, total: summary.days.length, blank: summary.blankDays }))
      : t("{logged} of {total} days have entries — every day logged.", { logged: summary.loggedDays, total: summary.days.length }),
    sections: [feeding, diapers, growth],
    volumeUnit,
    days: summary.days.map((day) => {
      const blank = !hasRoutineCare(day);
      return {
        label: dayFormat().format(day.date),
        feeds: blank ? "" : String(day.feeds),
        ml: blank ? "" : day.ml ? volumeParts(day.ml, units).value : "—",
        wet: blank ? "" : String(day.wet),
        dirty: blank ? "" : String(day.dirty),
        blank,
      };
    }),
    footnote: t("Recorded at home by a parent, not a clinical measurement. WHO Child Growth Standards; typical weekly gain per AAP."),
  };
}
