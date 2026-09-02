// "For the paediatrician" — the whole picture on one page.
//
// Designed to survive three exits: sent as a PDF (lib/visitPdf),
// sent as a picture (domain/shareCards) or read off the screen across a
// desk — this component. All three draw from the same VisitSummary, and the
// words on this screen and on the printed page come from ONE builder,
// visitDocument, so they can never disagree.
//
// The blank-days line is not decoration: "3 wet a day" means something
// completely different if four of the fourteen days were never logged, and
// a doctor cannot know that unless the sheet says so.

import { FileDown, Share2 } from "lucide-react";
import { toast } from "../lib/toast";
import { visitCard } from "../domain/shareCards";
import { shareLink } from "../domain/shareApp";
import { VisitDay, VisitFigure, visitDocument } from "../domain/visitDocument";
import { renderCard, shareFile } from "../lib/shareCard";
import { visitPdf } from "../lib/visitPdf";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { track } from "../domain/analytics";
import { expectedWeightRange, typicalWeeklyGain } from "../domain/growthReference";
import { formatBabyAge } from "../domain/time";
import { Profile } from "../domain/types";
import { useUnits } from "../domain/units";

/** The face from the share card, so the sheet reads as the same object. */
function Face() {
  return (
    <svg className="visit-face" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="52" r="42" fill="var(--card)" stroke="currentColor" strokeWidth="5" />
      <path d="M50 10c6-8 14-6 16 0" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <circle cx="36" cy="46" r="4" fill="currentColor" />
      <circle cx="64" cy="46" r="4" fill="currentColor" />
      <path d="M36 62q14 12 28 0" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

function Tile({ figure }: { figure: VisitFigure }) {
  return (
    <div className="visit-figure">
      <strong className="figure">
        {figure.value}
        {figure.unit && figure.value !== "—" && <span className="unit">{figure.unit}</span>}
      </strong>
      <span>{figure.label}</span>
    </div>
  );
}

function Row({ day }: { day: VisitDay }) {
  return (
    <tr className={day.blank ? "is-blank" : undefined}>
      <td>{day.label}</td>
      {day.blank ? (
        <td colSpan={4} className="visit-blank">not logged</td>
      ) : (
        <>
          <td>{day.feeds}</td>
          <td>{day.ml}</td>
          <td>{day.wet}</td>
          <td>{day.dirty}</td>
        </>
      )}
    </tr>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: Parameters<typeof visitDocument>[0];
  profile: Profile;
  ageMonths: number | null;
  now: number;
};

export function VisitSummarySheet({ open, onOpenChange, summary, profile, ageMonths, now }: Props) {
  const units = useUnits();
  const name = profile.name.trim() || "Baby";
  const age = formatBabyAge(profile.birthDate, now);
  const band = ageMonths === null ? null : expectedWeightRange(ageMonths, profile.sex);
  const gainBand = ageMonths === null ? null : typicalWeeklyGain(ageMonths);
  const doc = visitDocument(summary, name, age, units, band, gainBand, now);
  // Label the button by what the phone can do, so nobody taps "Share" on a
  // laptop and gets a download they did not expect.
  const canShareFiles = typeof navigator.canShare === "function" && navigator.canShare({ files: [new File([""], "x.pdf", { type: "application/pdf" })] });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="visit-sheet">
        <div className="visit-page">
          <header className="visit-head">
            <Face />
            <div className="visit-head-copy">
              <p className="visit-eyebrow">{doc.eyebrow}</p>
              <DialogTitle asChild><h2 className="visit-title">{doc.title}</h2></DialogTitle>
              <p className="visit-sub">{doc.sub}</p>
            </div>
          </header>

          {/* What the log can and cannot answer, said before any number. */}
          <p className="visit-coverage">{doc.coverage}</p>

          {doc.sections.map((section) => (
            <section className="visit-block" key={section.heading}>
              <h3>{section.heading}</h3>
              <div className="visit-figures">
                {section.figures.map((figure) => <Tile figure={figure} key={figure.label} />)}
              </div>
              <p className="visit-note">{section.note}</p>
            </section>
          ))}

          {/* Per-day table: the doctor who wants the raw days gets them. */}
          <section className="visit-block">
            <h3>Day by day</h3>
            <table className="visit-table">
              <thead>
                <tr><th>Day</th><th>Feeds</th><th>{doc.volumeUnit}</th><th>Wet</th><th>Dirty</th></tr>
              </thead>
              <tbody>
                {doc.days.map((day) => <Row day={day} key={day.label} />)}
              </tbody>
            </table>
          </section>

          <footer className="visit-footer">
            <span className="visit-brand">numalog.app</span>
            <p>{doc.footnote}</p>
          </footer>
        </div>

        {/* Pinned under the scroll, so the two buttons are never a page away.
            The dialog's own X closes; a third button here only pushed the
            two that matter onto a second row on a phone. */}
        <div className="visit-actions">
          {/* The PDF goes straight to the share sheet (WhatsApp to the
              clinic, mail to the doctor) or, where there is none, to the
              downloads — never through a print dialog. */}
          <Button
            onClick={() => {
              track("visit_summary_pdf");
              void visitPdf(doc)
                .then((blob) => shareFile(blob, `numalog-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "baby"}-summary.pdf`, `${name} · summary for the paediatrician · ${shareLink("visit")}`))
                .then((outcome) => { if (outcome === "saved") toast("PDF saved to your device"); })
                .catch(() => toast("Could not make the PDF on this phone"));
            }}
          >
            <FileDown size={16} aria-hidden="true" /> {canShareFiles ? "Share PDF" : "Download PDF"}
          </Button>
          {/* The same figures as one picture — what actually gets shown
              across the desk, or sent ahead to the clinic on WhatsApp. */}
          <Button
            variant="outline"
            onClick={() => {
              track("visit_summary_shared");
              void renderCard(visitCard(summary, name, age, units))
                .then((blob) => shareFile(blob, "numalog-visit-summary.png", `${name} · summary for the paediatrician · ${shareLink("visit")}`))
                .then((outcome) => { if (outcome === "saved") toast("Picture saved to your device"); })
                .catch(() => toast("Could not make the picture on this phone"));
            }}
          >
            <Share2 size={16} aria-hidden="true" /> Share as a picture
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
