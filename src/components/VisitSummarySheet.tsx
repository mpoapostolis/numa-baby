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

import { Printer, Share2, X } from "lucide-react";
import { toast } from "../lib/toast";
import { visitCard } from "../domain/shareCards";
import { VISIT_PRINT_CSS, renderVisitHtml, visitDocument } from "../domain/visitDocument";
import { printDocument } from "../lib/printDocument";
import { shareLink } from "../domain/shareApp";
import { renderCard, shareImage } from "../lib/shareCard";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { track } from "../domain/analytics";
import { hasRoutineCare } from "../domain/daySummary";
import { VisitSummary } from "../domain/visitSummary";
import { expectedWeightRange, typicalWeeklyGain } from "../domain/growthReference";
import { formatBabyAge } from "../domain/time";
import { Profile } from "../domain/types";
import { formatKg, formatVolume, useUnits, volumeParts, weightParts } from "../domain/units";

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
  const units = useUnits();
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
              <Figure
                value={summary.mlPerDay === null ? show(summary.mlPerDay) : volumeParts(summary.mlPerDay, units).value}
                unit={volumeParts(summary.mlPerDay ?? 0, units).unit}
                label="milk a day"
              />
              <Figure value={show(summary.nursingMinutesPerDay)} unit="m" label="nursing a day" />
            </div>
            <p className="visit-note">
              {summary.totalFeeds} feeds and {formatVolume(summary.totalMl, units)} across the window. Bottle volumes
              are bottles only.
            </p>
          </section>

          <section className="visit-block">
            <h3>Diapers</h3>
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
              <Figure value={weightKg === null ? "—" : weightParts(weightKg * 1_000, units).value} unit={weightParts(0, units).unit} label="latest weight" />
              <Figure
                value={summary.gramsPerWeek === null ? "—" : String(summary.gramsPerWeek)}
                unit="g"
                label="a week"
              />
            </div>
            <p className="visit-note">
              {band
                ? `WHO reference at this age: ${formatKg(band.p3, units)}–${formatKg(band.p97, units)} (P3–P97), midpoint ${formatKg(band.p50, units)}.`
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
                <tr><th>Day</th><th>Feeds</th><th>{volumeParts(0, units).unit}</th><th>Wet</th><th>Dirty</th></tr>
              </thead>
              <tbody>
                {summary.days.map((day) => (
                  <tr key={day.date.toISOString()} className={hasRoutineCare(day) ? undefined : "is-blank"}>
                    <td>{dateFormat.format(day.date)}</td>
                    {!hasRoutineCare(day) ? (
                      <td colSpan={4} className="visit-blank">not logged</td>
                    ) : (
                      <>
                        <td>{day.feeds}</td>
                        <td>{day.ml ? volumeParts(day.ml, units).value : "—"}</td>
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
            typical weekly gain per AAP. Numalog.
          </p>
        </div>

        <div className="visit-actions">
          {/* Printed as a document of its own (see lib/printDocument): the
              same figures, laid out like the share card, from the top of
              the first page. */}
          <Button
            onClick={() => {
              track("visit_summary_printed");
              const doc = visitDocument(summary, name, age, units, band, gainBand, now);
              void printDocument(`${name} · summary for the paediatrician`, renderVisitHtml(doc), VISIT_PRINT_CSS);
            }}
          >
            <Printer size={16} aria-hidden="true" /> Print or save as PDF
          </Button>
          {/* The same figures as one picture — what actually gets shown
              across the desk, or sent ahead to the clinic on WhatsApp. */}
          <Button
            variant="outline"
            onClick={() => {
              track("visit_summary_shared");
              void renderCard(visitCard(summary, name, age, units))
                .then((blob) => shareImage(blob, "numalog-visit-summary.png", `${name} · summary for the paediatrician · ${shareLink("visit")}`))
                .then((outcome) => { if (outcome === "saved") toast("Picture saved to your device"); })
                .catch(() => toast("Could not make the picture on this phone"));
            }}
          >
            <Share2 size={16} aria-hidden="true" /> Share as a picture
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <X size={16} aria-hidden="true" /> Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
