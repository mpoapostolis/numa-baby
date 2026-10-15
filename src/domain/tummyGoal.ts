// How much tummy time to aim for in a day, by age — so the row on Today can
// say what is left, not only what was done ("12m of 30m today · 18m to go").
//
// The numbers are the ones the Guide already quotes (AAP, "Back to Sleep,
// Tummy to Play"): 3 to 5 minutes, 2 or 3 times a day at first, building to
// 15–30 minutes a day by around 7 weeks — and WHO asks for at least 30
// minutes a day for a baby who is not yet moving about. By around 7 months
// most babies roll both ways and the floor does the rest: no goal then.

/** Calendar day the 15–30 minute target applies from: 7 weeks. */
const FULL_GOAL_FROM_DAY = 49;
/** About 7 months: rolling both ways, and floor time stops being timed. */
const GOAL_UNTIL_DAY = 213;

export function tummyGoalMinutes(ageDays: number | null): number | null {
  if (ageDays === null || !Number.isFinite(ageDays) || ageDays < 0) return null;
  if (ageDays < FULL_GOAL_FROM_DAY) return 10;
  if (ageDays < GOAL_UNTIL_DAY) return 30;
  return null;
}
