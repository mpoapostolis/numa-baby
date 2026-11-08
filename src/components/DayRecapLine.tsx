// The same day as one line, under each Timeline day heading. Its own module
// because only the Timeline (a lazy screen) shows it: in DayRecap.tsx it rode
// along with Today's card in the bundle every phone loads first.

import { DaySummary } from "../domain/daySummary";
import { humanDuration } from "../domain/time";
import { formatVolume, useUnits } from "../domain/units";

/**
 * The same day as one line, for a Timeline day heading. Only the parts that
 * happened appear — an empty day renders nothing at all.
 */
export function DayRecapLine({ summary }: { summary: DaySummary }) {
  const units = useUnits();
  const parts: string[] = [];
  if (summary.feeds > 0) parts.push(`${summary.feeds} ${summary.feeds === 1 ? "feed" : "feeds"}`);
  if (summary.ml > 0) parts.push(formatVolume(summary.ml, units));
  // Nursing by side, the minutes each side had (asked for from the feedback
  // box). Only sides that were used; a both-sides session keeps its own part,
  // because nobody timed how it split.
  const { left, right, both, unsaid } = summary.nursingBySide;
  if (left > 0) parts.push(`Left ${humanDuration(left)}`);
  if (right > 0) parts.push(`Right ${humanDuration(right)}`);
  if (both > 0) parts.push(`Both sides ${humanDuration(both)}`);
  if (unsaid > 0) parts.push(`${humanDuration(unsaid)} nursing`);
  if (summary.wet > 0) parts.push(`${summary.wet} wet`);
  if (summary.dirty > 0) parts.push(`${summary.dirty} dirty`);
  if (summary.sleepMinutes > 0) parts.push(`${humanDuration(summary.sleepMinutes)} sleep`);
  if (summary.solids > 0) parts.push(`${summary.solids} ${summary.solids === 1 ? "solid" : "solids"}`);
  if (parts.length === 0) return null;
  return <p className="recap-line">{parts.join(" · ")}</p>;
}
