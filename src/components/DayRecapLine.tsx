// The same day as one line, under each Timeline day heading. Its own module
// because only the Timeline (a lazy screen) shows it: in DayRecap.tsx it rode
// along with Today's card in the bundle every phone loads first.

import { DaySummary } from "../domain/daySummary";
import { humanDuration } from "../domain/time";
import { formatVolume, useUnits } from "../domain/units";
import { t } from "../i18n";

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
  // Nursing by side, the minutes each side had (asked for from the feedback
  // box). Only sides that were used; a both-sides session keeps its own part,
  // because nobody timed how it split.
  const { left, right, both, unsaid } = summary.nursingBySide;
  if (left > 0) parts.push(t("Left {duration}", { duration: humanDuration(left) }));
  if (right > 0) parts.push(t("Right {duration}", { duration: humanDuration(right) }));
  if (both > 0) parts.push(t("Both sides {duration}", { duration: humanDuration(both) }));
  if (unsaid > 0) parts.push(t("{duration} nursing", { duration: humanDuration(unsaid) }));
  if (summary.wet > 0) parts.push(t("{n} wet", { n: summary.wet }));
  if (summary.dirty > 0) parts.push(t("{n} dirty", { n: summary.dirty }));
  if (summary.sleepMinutes > 0) parts.push(t("{duration} sleep", { duration: humanDuration(summary.sleepMinutes) }));
  if (summary.solids > 0) parts.push(summary.solids === 1 ? t("1 solid") : t("{n} solids", { n: summary.solids }));
  if (parts.length === 0) return null;
  return <p className="recap-line">{parts.join(" · ")}</p>;
}
