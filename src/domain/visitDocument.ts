// The paediatrician summary as words: what goes on the sheet, the PDF page
// (lib/visitPdf.ts) and the picture, built once from the same VisitSummary
// so the three can never disagree.

import { hasRoutineCare } from "./daySummary";
import { UnitSystem, formatKg, formatVolume, volumeParts, weightParts } from "./units";
import { VisitSummary } from "./visitSummary";

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

const dayFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "short" });
const longDate = new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric" });

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
  const who = name.trim() || "Baby";
  const first = summary.days[0]?.date;
  const last = summary.days[summary.days.length - 1]?.date;
  const window = first && last ? `${dayFormat.format(first)} – ${dayFormat.format(last)}` : "";
  const weightUnit = weightParts(0, units).unit;
  const volumeUnit = volumeParts(0, units).unit;

  const feeding: VisitSection = {
    heading: "Feeding",
    figures: [
      { value: show(summary.feedsPerDay), label: "feeds a day" },
      { value: summary.mlPerDay === null ? "—" : volumeParts(summary.mlPerDay, units).value, unit: volumeUnit, label: "milk a day" },
      { value: show(summary.nursingMinutesPerDay), unit: "min", label: "nursing a day" },
    ],
    note: `${summary.totalFeeds} feeds and ${formatVolume(summary.totalMl, units)} across the window. Bottle volumes are bottles only.`,
  };
  const diapers: VisitSection = {
    heading: "Nappies",
    figures: [
      { value: show(summary.wetPerDay), label: "wet a day" },
      { value: show(summary.dirtyPerDay), label: "dirty a day" },
    ],
    note: `${summary.totalWet} wet and ${summary.totalDirty} dirty across the window. A change recorded as both counts in each.`,
  };
  const growth: VisitSection = {
    heading: "Growth",
    figures: [
      { value: summary.latestWeightGrams ? weightParts(summary.latestWeightGrams, units).value : "—", unit: weightUnit, label: "latest weight" },
      { value: summary.gramsPerWeek === null ? "—" : String(summary.gramsPerWeek), unit: "g", label: "gained a week" },
    ],
    note: [
      band
        ? `WHO reference at this age: ${formatKg(band.p3, units)}–${formatKg(band.p97, units)} (P3–P97), midpoint ${formatKg(band.p50, units)}.`
        : "No age on file, so no WHO reference is shown.",
      gain ? `Typical gain ${gain.minGramsPerWeek}–${gain.maxGramsPerWeek} g a week.` : "",
    ].filter(Boolean).join(" "),
  };

  return {
    eyebrow: "For the paediatrician",
    title: age ? `${who}, ${age} old` : who,
    sub: [window, `${summary.days.length} days`, `printed ${longDate.format(new Date(now))}`].filter(Boolean).join(" · "),
    coverage: summary.blankDays > 0
      ? `${summary.loggedDays} of ${summary.days.length} days have entries. ${summary.blankDays} ${summary.blankDays === 1 ? "day was" : "days were"} not logged, so the daily figures are medians over the logged days only.`
      : `${summary.loggedDays} of ${summary.days.length} days have entries — every day logged.`,
    sections: [feeding, diapers, growth],
    volumeUnit,
    days: summary.days.map((day) => {
      const blank = !hasRoutineCare(day);
      return {
        label: dayFormat.format(day.date),
        feeds: blank ? "" : String(day.feeds),
        ml: blank ? "" : day.ml ? volumeParts(day.ml, units).value : "—",
        wet: blank ? "" : String(day.wet),
        dirty: blank ? "" : String(day.dirty),
        blank,
      };
    }),
    footnote: "Recorded at home by a parent, not a clinical measurement. WHO Child Growth Standards; typical weekly gain per AAP.",
  };
}
