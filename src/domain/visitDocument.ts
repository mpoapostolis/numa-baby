// The paediatrician summary as a printed page: what goes on it and how it
// is written, apart from how it is sent to the printer (lib/printDocument).
//
// The same figures as the on-screen sheet — built from the same VisitSummary
// — laid out like the share card, so the page a doctor is handed looks like
// it came from the same hands as the picture on the parent's phone.

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

const esc = (value: string) =>
  value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

/** The face from the share card, as a small inline mark. */
const FACE = `<svg class="face" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="52" r="42" fill="#fffaf8" stroke="#a3496f" stroke-width="5"/><path d="M50 10c6-8 14-6 16 0" fill="none" stroke="#a3496f" stroke-width="5" stroke-linecap="round"/><circle cx="36" cy="46" r="4" fill="#a3496f"/><circle cx="64" cy="46" r="4" fill="#a3496f"/><path d="M36 62q14 12 28 0" fill="none" stroke="#a3496f" stroke-width="5" stroke-linecap="round"/></svg>`;

export const VISIT_PRINT_CSS = `
@page { size: A4; margin: 12mm 14mm 12mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  color: #2b2326; background: #fff;
  font: 10.5pt/1.4 "Geist Variable", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.head { display: flex; align-items: flex-start; gap: 14pt; margin-bottom: 10pt; }
.face { width: 44pt; height: 44pt; flex: 0 0 auto; }
.eyebrow { margin: 0; color: #a3496f; font-size: 9pt; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }
h1 { margin: 2pt 0 0; font-size: 24pt; font-weight: 600; letter-spacing: -.02em; line-height: 1.1; }
.sub { margin: 4pt 0 0; color: #6a5c60; font-size: 10pt; }
.coverage { margin: 0 0 8pt; padding: 7pt 11pt; border-radius: 8pt; background: #fdf5f2; font-size: 10pt; }
h2 { margin: 9pt 0 5pt; color: #6a5c60; font-size: 8.5pt; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }
.tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8pt; }
.tile { padding: 7pt 11pt 6pt; border: 1px solid #eadcd6; border-radius: 10pt; background: #fffaf8; break-inside: avoid; }
.tile b { display: block; font-size: 18pt; font-weight: 600; line-height: 1.1; font-variant-numeric: tabular-nums; }
.tile b small { margin-left: 2pt; font-size: 10pt; font-weight: 500; color: #6a5c60; }
.tile span { display: block; margin-top: 2pt; color: #6a5c60; font-size: 9pt; }
.note { margin: 5pt 0 0; color: #6a5c60; font-size: 9.5pt; }
table { width: 100%; margin-top: 2pt; border-collapse: collapse; font-size: 10pt; font-variant-numeric: tabular-nums; }
th { padding: 3pt 6pt; color: #6a5c60; font-size: 8pt; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; text-align: right; border-bottom: 1px solid #eadcd6; }
td { padding: 2.5pt 6pt; text-align: right; border-bottom: 1px solid #f3e9e4; }
th:first-child, td:first-child { text-align: left; }
tr { break-inside: avoid; }
td.blank { color: #8a7a80; font-style: italic; text-align: left; }
.foot { display: flex; align-items: baseline; justify-content: space-between; gap: 12pt; margin-top: 10pt; padding-top: 7pt; break-inside: avoid; border-top: 1px solid #eadcd6; }
.foot .brand { color: #a3496f; font-weight: 600; font-size: 11pt; white-space: nowrap; }
.foot p { margin: 0; color: #6a5c60; font-size: 8.5pt; text-align: right; }
`;

export function renderVisitHtml(doc: VisitDocument): string {
  const figure = (f: VisitFigure) =>
    `<div class="tile"><b>${esc(f.value)}${f.unit && f.value !== "—" ? `<small>${esc(f.unit)}</small>` : ""}</b><span>${esc(f.label)}</span></div>`;
  const section = (s: VisitSection) =>
    `<h2>${esc(s.heading)}</h2><div class="tiles">${s.figures.map(figure).join("")}</div><p class="note">${esc(s.note)}</p>`;
  const row = (d: VisitDay) =>
    d.blank
      ? `<tr><td>${esc(d.label)}</td><td class="blank" colspan="4">not logged</td></tr>`
      : `<tr><td>${esc(d.label)}</td><td>${esc(d.feeds)}</td><td>${esc(d.ml)}</td><td>${esc(d.wet)}</td><td>${esc(d.dirty)}</td></tr>`;
  return `<header class="head">${FACE}<div><p class="eyebrow">${esc(doc.eyebrow)}</p><h1>${esc(doc.title)}</h1><p class="sub">${esc(doc.sub)}</p></div></header>
<p class="coverage">${esc(doc.coverage)}</p>
${doc.sections.map(section).join("")}
<h2>Day by day</h2>
<table><thead><tr><th>Day</th><th>Feeds</th><th>${esc(doc.volumeUnit)}</th><th>Wet</th><th>Dirty</th></tr></thead><tbody>${doc.days.map(row).join("")}</tbody></table>
<footer class="foot"><span class="brand">numalog.app</span><p>${esc(doc.footnote)}</p></footer>`;
}
