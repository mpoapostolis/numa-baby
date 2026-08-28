// "For the paediatrician" — the whole picture on one page.
//
// Designed to survive three exits: printed on paper, screenshotted on a
// phone, or read off the screen across a desk. That is why it is one column,
// no scroll-dependent chrome, and no colour that carries meaning on its own.
//
// The numbers are reductions of what the family logged. The blank-days line
// is not decoration: "3 wet a day" means something completely different if
// four of the fourteen days were never logged, and a doctor cannot know that
// unless the sheet says so.

import { Printer, X } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { track } from "../domain/analytics";
import { VisitSummary } from "../domain/visitSummary";
import { expectedWeightRange, typicalWeeklyGain } from "../domain/growthReference";
import { formatBabyAge } from "../domain/time";
import { Profile } from "../domain/types";

const dateFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "short" });
const longDate = new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric" });

function Figure({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <div className="visit-figure">
      <strong className="figure">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </strong>
      <span>{label}</span>
    </div>
  );
}

const show = (value: number | null, digits = 0) =>
  value === null ? "—" : value.toFixed(digits);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: VisitSummary;
  profile: Profile;
  ageMonths: number | null;
  now: number;
};

export function VisitSummarySheet({ open, onOpenChange, summary, profile, ageMonths, now }: Props) {
  const name = profile.name.trim() || "Baby";
  const age = formatBabyAge(profile.birthDate, now);
  const first = summary.days[0]?.date;
  const last = summary.days.at(-1)?.date;
  const weightKg = summary.latestWeightGrams ? summary.latestWeightGrams / 1_000 : null;
  const band = ageMonths === null ? null : expectedWeightRange(ageMonths, profile.sex);
  const gainBand = ageMonths === null ? null : typicalWeeklyGain(ageMonths);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="visit-sheet">
        <div className="visit-page">
          <header className="visit-head">
            <div>
              <DialogTitle asChild><h2 className="visit-title">{name}</h2></DialogTitle>
              <p className="visit-sub">
                {age ? `${age} old · ` : ""}
                {first && last ? `${dateFormat.format(first)} – ${dateFormat.format(last)}` : ""}
                {" · "}{summary.days.length} days
              </p>
            </div>
            <p className="visit-printed">Printed {longDate.format(new Date(now))}</p>
          </header>

          {/* What the log can and cannot answer, said before any number. */}
          <p className="visit-coverage">
            {summary.loggedDays} of {summary.days.length} days have entries
            {summary.blankDays > 0
              ? ` · ${summary.blankDays} ${summary.blankDays === 1 ? "day was" : "days were"} not logged, so daily figures are medians over the logged days only`
              : " · every day logged"}
          </p>

          <section className="visit-block">
            <h3>Feeding</h3>
            <div className="visit-figures">
              <Figure value={show(summary.feedsPerDay)} label="feeds a day" />
              <Figure value={show(summary.mlPerDay)} unit="ml" label="milk a day" />
              <Figure value={show(summary.nursingMinutesPerDay)} unit="m" label="nursing a day" />
            </div>
            <p className="visit-note">
              {summary.totalFeeds} feeds and {summary.totalMl} ml across the window. Millilitres
              are bottles only.
            </p>
          </section>

          <section className="visit-block">
            <h3>Nappies</h3>
            <div className="visit-figures">
              <Figure value={show(summary.wetPerDay)} label="wet a day" />
              <Figure value={show(summary.dirtyPerDay)} label="dirty a day" />
            </div>
            <p className="visit-note">
              {summary.totalWet} wet and {summary.totalDirty} dirty across the window. A change
              recorded as both counts in each.
            </p>
          </section>

          <section className="visit-block">
            <h3>Growth</h3>
            <div className="visit-figures">
              <Figure value={weightKg === null ? "—" : weightKg.toFixed(2)} unit="kg" label="latest weight" />
              <Figure
                value={summary.gramsPerWeek === null ? "—" : String(summary.gramsPerWeek)}
                unit="g"
                label="a week"
              />
            </div>
            <p className="visit-note">
              {band
                ? `WHO reference at this age: ${band.p3.toFixed(1)}–${band.p97.toFixed(1)} kg (P3–P97), midpoint ${band.p50.toFixed(1)} kg.`
                : "No age on file, so no WHO reference is shown."}
              {gainBand
                ? ` Typical gain ${gainBand.minGramsPerWeek}–${gainBand.maxGramsPerWeek} g a week.`
                : ""}
            </p>
          </section>

          {/* Per-day table: the doctor who wants the raw days gets them. */}
          <section className="visit-block">
            <h3>Day by day</h3>
            <table className="visit-table">
              <thead>
                <tr><th>Day</th><th>Feeds</th><th>ml</th><th>Wet</th><th>Dirty</th></tr>
              </thead>
              <tbody>
                {summary.days.map((day) => (
                  <tr key={day.date.toISOString()} className={day.isEmpty ? "is-blank" : undefined}>
                    <td>{dateFormat.format(day.date)}</td>
                    {day.isEmpty ? (
                      <td colSpan={4} className="visit-blank">not logged</td>
                    ) : (
                      <>
                        <td>{day.feeds}</td>
                        <td>{day.ml || "—"}</td>
                        <td>{day.wet}</td>
                        <td>{day.dirty}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <p className="visit-footer">
            Recorded at home by a parent, not a clinical measurement. WHO Child Growth Standards;
            typical weekly gain per AAP. Baby Tracker.
          </p>
        </div>

        <div className="visit-actions">
          <Button onClick={() => { track("visit_summary_printed"); window.print(); }}>
            <Printer size={16} aria-hidden="true" /> Print or save as PDF
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <X size={16} aria-hidden="true" /> Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
